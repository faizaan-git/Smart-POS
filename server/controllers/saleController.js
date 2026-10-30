const prisma = require("../prisma/client");
const { LOW_STOCK_THRESHOLD, notifyLowStock, notifySaleCompleted } = require("../services/notificationService");

const createSaleHandler = (db) => async (req, res) => {
  const { cart, paymentMethod = "Cash", cashReceived, customerId } = req.body || {};

  if (!Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ message: "Cart is empty" });
  }

  const quantities = new Map();
  for (const item of cart) {
    const id = Number(item?.id);
    const qty = Number(item?.qty);

    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      id > 2147483647 ||
      !Number.isSafeInteger(qty) ||
      qty < 1 ||
      qty > 2147483647
    ) {
      return res.status(400).json({ message: "Cart contains an invalid product or quantity" });
    }

    const totalQuantity = (quantities.get(id) || 0) + qty;
    if (totalQuantity > 2147483647) {
      return res.status(400).json({ message: "Cart quantity is too large" });
    }
    quantities.set(id, totalQuantity);
  }

  const normalizedCustomerId = customerId == null || customerId === ""
    ? null
    : Number(customerId);
  if (
    normalizedCustomerId !== null &&
    (!Number.isSafeInteger(normalizedCustomerId) || normalizedCustomerId < 1)
  ) {
    return res.status(400).json({ message: "Customer is invalid" });
  }

  if (!["Cash", "Card", "UPI"].includes(paymentMethod)) {
    return res.status(400).json({ message: "Payment method is invalid" });
  }

  try {
    const lowStockCrossings = [];
    const sale = await db.$transaction(async (tx) => {
      const ids = [...quantities.keys()];
      const products = await tx.product.findMany({
        where: { id: { in: ids } },
      });

      if (products.length !== ids.length) {
        const error = new Error("One or more products were not found");
        error.statusCode = 404;
        throw error;
      }

      const settings = await tx.pOSSettings.findFirst();
      const allowNegativeStock = settings?.allowNegativeStock ?? false;
      const taxEnabled = settings?.enableTax ?? false;
      const discountEnabled = settings?.enableDiscount ?? false;
      const currency = settings?.currency ?? "INR";
      const configuredTaxRate = Number(settings?.defaultTaxRate ?? 0);
      const configuredDiscountRate = Number(settings?.defaultDiscount ?? 0);

      if (
        (taxEnabled && (!Number.isFinite(configuredTaxRate) || configuredTaxRate < 0 || configuredTaxRate > 100)) ||
        (discountEnabled && (!Number.isFinite(configuredDiscountRate) || configuredDiscountRate < 0 || configuredDiscountRate > 100)) ||
        !["INR", "USD"].includes(currency)
      ) {
        const error = new Error("POS pricing or currency settings are invalid");
        error.statusCode = 400;
        throw error;
      }

      if (normalizedCustomerId !== null) {
        const customer = await tx.customer.findUnique({
          where: { id: normalizedCustomerId },
        });
        if (!customer) {
          const error = new Error("Customer not found");
          error.statusCode = 404;
          throw error;
        }
      } else if (settings?.requireCustomer) {
        const error = new Error("A customer is required for this sale");
        error.statusCode = 400;
        throw error;
      }

      const productsById = new Map(products.map((product) => [product.id, product]));
      const items = ids.map((id) => {
        const product = productsById.get(id);
        const qty = quantities.get(id);
        return {
          productId: id,
          quantity: qty,
          price: Number(product.sellingPrice),
        };
      });
      const roundCurrency = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;
      const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.quantity * item.price, 0));

      if (!Number.isFinite(subtotal)) {
        const error = new Error("Sale total is invalid");
        error.statusCode = 400;
        throw error;
      }

      const discountRate = discountEnabled ? configuredDiscountRate : 0;
      const taxRate = taxEnabled ? configuredTaxRate : 0;
      const discountAmount = roundCurrency(subtotal * discountRate / 100);
      const discountedAmount = roundCurrency(subtotal - discountAmount);
      const taxableAmount = taxRate > 0
        ? roundCurrency(discountedAmount / (1 + taxRate / 100))
        : discountedAmount;
      const taxAmount = roundCurrency(discountedAmount - taxableAmount);
      const exactTotal = discountedAmount;
      const total = Math.ceil(exactTotal);
      const roundingAmount = roundCurrency(total - exactTotal);

      if (![discountAmount, taxAmount, exactTotal, roundingAmount, total].every(Number.isFinite)) {
        const error = new Error("Sale total is invalid");
        error.statusCode = 400;
        throw error;
      }

      const received = cashReceived == null || cashReceived === ""
        ? total
        : Number(cashReceived);
      if (paymentMethod === "Cash" && (!Number.isFinite(received) || received < total)) {
        const error = new Error("Cash received is less than the sale total");
        error.statusCode = 400;
        throw error;
      }

      for (const item of items) {
        const product = productsById.get(item.productId);
        const result = await tx.product.updateMany({
          where: {
            id: item.productId,
            ...(allowNegativeStock ? {} : { stock: { gte: item.quantity } }),
          },
          data: { stock: { decrement: item.quantity } },
        });

        if (result.count !== 1) {
          const error = new Error("Insufficient stock for one or more products");
          error.statusCode = 409;
          throw error;
        }

        const resultingStock = product.stock - item.quantity;
        if (product.stock > LOW_STOCK_THRESHOLD && resultingStock <= LOW_STOCK_THRESHOLD) {
          lowStockCrossings.push({
            id: product.id,
            name: product.name,
            stock: resultingStock,
          });
        }
      }

      const sale = await tx.sale.create({
        data: {
          total,
          subtotal,
          taxAmount,
          taxRate,
          discountAmount,
          discountRate,
          roundingAmount,
          currency,
          cashierId: req.user?.id || null,
          paymentMethod,
          cashReceived: paymentMethod === "Cash" ? received : null,
          customerId: normalizedCustomerId,
          items: { create: items },
        },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
      });

      const invoicePrefix = settings?.invoicePrefix ?? "INV-";
      const startingInvoiceNo = settings?.startingInvoiceNo ?? 1001;
      const invoiceNumber = `${invoicePrefix}${startingInvoiceNo + sale.id - 1}`;

      return tx.sale.update({
        where: { id: sale.id },
        data: { invoiceNumber },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
      });
    });

    if (req.user?.id) {
      await Promise.all([
        notifySaleCompleted(db, sale, req.user.id),
        ...lowStockCrossings.map((product) => notifyLowStock(db, product)),
      ]);
    }

    return res.status(201).json({
      message: "Sale completed successfully",
      sale,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error("SALE ERROR", error);
    return res.status(500).json({ message: "Failed to complete sale" });
  }
};

exports.createSale = createSaleHandler(prisma);
exports.createSaleHandler = createSaleHandler;

// =========================
// Get Sales History
// =========================
exports.getSales = async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        customer: true,

        items: {
          include: {
            product: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(sales);
  } catch (error) {
    console.error("GET SALES ERROR");
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};