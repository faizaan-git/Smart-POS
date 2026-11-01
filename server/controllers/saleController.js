const prisma = require("../prisma/client");
const QRCode = require("qrcode");
const { randomUUID } = require("node:crypto");
const { LOW_STOCK_THRESHOLD, notifyLowStock, notifySaleCompleted } = require("../services/notificationService");

const createSaleHandler = (db, { upiOnly = false } = {}) => async (req, res) => {
  const { cart, paymentMethod = "Cash", cashReceived, customerId } = req.body || {};
  const merchantId = Number(req.user?.merchantId);

  if (!Number.isSafeInteger(merchantId) || merchantId < 1) {
    return res.status(403).json({ message: "Your account is not associated with a merchant" });
  }

  if (upiOnly !== (paymentMethod === "UPI")) {
    return res.status(400).json({
      message: upiOnly
        ? "This endpoint only creates UPI payments"
        : "UPI payments must use the UPI payment workflow",
    });
  }

  if (!Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ message: "Cart is empty" });
  }

  let idempotencyKey;
  if (upiOnly) {
    idempotencyKey = req.body.idempotencyKey;
    if (
      typeof idempotencyKey !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)
    ) {
      return res.status(400).json({ message: "A valid UPI payment request ID is required" });
    }

    try {
      const existingPayment = await db.payment.findUnique({
        where: { idempotencyKey },
        include: { sale: true },
      });
      if (existingPayment) {
        if (existingPayment.merchantId !== merchantId) {
          return res.status(409).json({ message: "Payment request ID is already in use" });
        }
        if (existingPayment.status !== "PENDING" || existingPayment.expiresAt <= new Date()) {
          return res.status(409).json({ message: "This payment request is no longer active" });
        }
        const qrCodeDataUrl = await QRCode.toDataURL(existingPayment.paymentUri);
        return res.status(200).json({
          message: "UPI payment is pending staff approval",
          sale: existingPayment.sale,
          payment: {
            id: existingPayment.id,
            amount: Number(existingPayment.amount),
            currency: existingPayment.currency,
            transactionReference: existingPayment.transactionReference,
            upiId: existingPayment.merchantUpiId,
            businessName: existingPayment.merchantBusinessName,
            displayName: existingPayment.merchantDisplayName,
            instructions: existingPayment.paymentInstructions,
            status: existingPayment.status,
            expiresAt: existingPayment.expiresAt,
            paymentUri: existingPayment.paymentUri,
            qrCodeDataUrl,
          },
        });
      }
    } catch (error) {
      console.error("UPI payment idempotency lookup failed:", error);
      return res.status(500).json({ message: "Failed to check the UPI payment request" });
    }
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
    const result = await db.$transaction(async (tx) => {
      const paymentSettings = upiOnly
        ? await tx.merchantPaymentSettings.findUnique({ where: { merchantId } })
        : null;

      if (
        upiOnly &&
        (!paymentSettings?.enabled ||
          !/^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}$/.test(paymentSettings.upiId) ||
          !paymentSettings.upiDisplayName?.trim())
      ) {
        const error = new Error("UPI payments are not enabled for this merchant");
        error.statusCode = 409;
        throw error;
      }

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

      if (upiOnly && currency !== "INR") {
        const error = new Error("UPI payments are only available for INR billing");
        error.statusCode = 409;
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

      if (upiOnly && (!Number.isSafeInteger(total) || total <= 0 || total > 9999999999.99)) {
        const error = new Error("UPI payment amount is outside the supported range");
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

      if (!upiOnly) {
        for (const item of items) {
          const product = productsById.get(item.productId);
          const stockUpdate = await tx.product.updateMany({
            where: {
              id: item.productId,
              ...(allowNegativeStock ? {} : { stock: { gte: item.quantity } }),
            },
            data: { stock: { decrement: item.quantity } },
          });

          if (stockUpdate.count !== 1) {
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
      }

      const transactionReference = upiOnly ? `SP-${randomUUID()}` : null;
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
          merchantId,
          paymentMethod,
          paymentStatus: upiOnly ? "PENDING" : "PAID",
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

      const completedSale = await tx.sale.update({
        where: { id: sale.id },
        data: { invoiceNumber },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
      });

      if (!upiOnly) {
        return { sale: completedSale };
      }

      const encodedParams = new URLSearchParams({
        pa: paymentSettings.upiId,
        pn: paymentSettings.upiDisplayName.trim(),
        am: total.toFixed(2),
        cu: "INR",
        tn: transactionReference,
      });
      const paymentUri = `upi://pay?${encodedParams.toString()}`;
      const expiresAt = new Date(
        Date.now() + paymentSettings.qrExpirationMinutes * 60 * 1000
      );
      const payment = await tx.payment.create({
        data: {
          merchantId,
          saleId: sale.id,
          amount: total.toFixed(2),
          currency: "INR",
          transactionReference,
          idempotencyKey,
          paymentUri,
          merchantUpiId: paymentSettings.upiId,
          merchantBusinessName: paymentSettings.businessName,
          merchantDisplayName: paymentSettings.upiDisplayName.trim(),
          paymentInstructions: paymentSettings.paymentInstructions,
          expiresAt,
        },
      });

      return { sale: completedSale, payment };
    });

    if (!upiOnly && req.user?.id) {
      await Promise.all([
        notifySaleCompleted(db, result.sale, req.user.id),
        ...lowStockCrossings.map((product) => notifyLowStock(db, product, merchantId)),
      ]);
    }

    if (upiOnly) {
      const qrCodeDataUrl = await QRCode.toDataURL(result.payment.paymentUri);
      return res.status(201).json({
        message: "UPI payment is pending staff approval",
        sale: result.sale,
        payment: {
          id: result.payment.id,
          amount: Number(result.payment.amount),
          currency: result.payment.currency,
          transactionReference: result.payment.transactionReference,
          upiId: result.payment.merchantUpiId,
          businessName: result.payment.merchantBusinessName,
          displayName: result.payment.merchantDisplayName,
          instructions: result.payment.paymentInstructions,
          status: result.payment.status,
          expiresAt: result.payment.expiresAt,
          paymentUri: result.payment.paymentUri,
          qrCodeDataUrl,
        },
      });
    }

    return res.status(201).json({
      message: "Sale completed successfully",
      sale: result.sale,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    if (upiOnly && error.code === "P2002") {
      try {
        const existingPayment = await db.payment.findUnique({
          where: { idempotencyKey },
          include: { sale: true },
        });
        if (existingPayment?.merchantId === merchantId) {
          const qrCodeDataUrl = await QRCode.toDataURL(existingPayment.paymentUri);
          return res.status(200).json({
            message: "UPI payment is pending staff approval",
            sale: existingPayment.sale,
            payment: {
              id: existingPayment.id,
              amount: Number(existingPayment.amount),
              currency: existingPayment.currency,
              transactionReference: existingPayment.transactionReference,
              upiId: existingPayment.merchantUpiId,
              businessName: existingPayment.merchantBusinessName,
              displayName: existingPayment.merchantDisplayName,
              instructions: existingPayment.paymentInstructions,
              status: existingPayment.status,
              expiresAt: existingPayment.expiresAt,
              paymentUri: existingPayment.paymentUri,
              qrCodeDataUrl,
            },
          });
        }
      } catch (lookupError) {
        console.error("UPI payment idempotency recovery failed:", lookupError);
        return res.status(500).json({ message: "Failed to recover the UPI payment request" });
      }
      return res.status(409).json({ message: "UPI payment request conflicts with an existing transaction" });
    }

    console.error("SALE ERROR", error);
    return res.status(500).json({ message: "Failed to complete sale" });
  }
};

exports.createSale = createSaleHandler(prisma);
exports.createSaleHandler = createSaleHandler;
exports.createUpiPayment = createSaleHandler(prisma, { upiOnly: true });

// =========================
// Get Sales History
// =========================
exports.getSales = async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      where: {
        merchantId: req.user.merchantId,
        paymentStatus: "PAID",
      },
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