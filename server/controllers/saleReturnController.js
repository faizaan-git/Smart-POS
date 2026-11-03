const prisma = require("../prisma/client");
const {
  LOW_STOCK_THRESHOLD,
  notifyLowStock,
  resolveLowStock,
} = require("../services/notificationService");

const cents = (amount) => Math.round(Number(amount) * 100);

const createSaleReturnHandler = (db = prisma) => async (req, res) => {
  const saleId = Number(req.params.saleId);
  const merchantId = Number(req.user?.merchantId);
  const processedById = Number(req.user?.id);
  const requestedItems = req.body?.items;
  const requestedReplacements = req.body?.replacements ?? [];
  const paymentMethod = req.body?.paymentMethod;
  const paymentReceived = req.body?.paymentReceived === true;

  if (!Number.isSafeInteger(saleId) || saleId < 1) {
    return res.status(400).json({ message: "Sale ID is invalid" });
  }
  if (!Number.isSafeInteger(merchantId) || merchantId < 1) {
    return res.status(403).json({ message: "Your account is not associated with a merchant" });
  }
  if (!Number.isSafeInteger(processedById) || processedById < 1) {
    return res.status(403).json({ message: "Your account could not be verified" });
  }
  if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
    return res.status(400).json({ message: "Select at least one item to return" });
  }
  if (!Array.isArray(requestedReplacements)) {
    return res.status(400).json({ message: "Replacement items are invalid" });
  }

  const requestedByItemId = new Map();
  for (const item of requestedItems) {
    const saleItemId = Number(item?.saleItemId);
    const quantity = Number(item?.quantity);
    if (
      !Number.isSafeInteger(saleItemId) ||
      saleItemId < 1 ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      requestedByItemId.has(saleItemId)
    ) {
      return res.status(400).json({ message: "Return items contain an invalid item or quantity" });
    }
    requestedByItemId.set(saleItemId, quantity);
  }

  const requestedByProductId = new Map();
  for (const item of requestedReplacements) {
    const productId = Number(item?.productId);
    const quantity = Number(item?.quantity);
    if (
      !Number.isSafeInteger(productId) ||
      productId < 1 ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      requestedByProductId.has(productId)
    ) {
      return res.status(400).json({ message: "Replacement items contain an invalid product or quantity" });
    }
    requestedByProductId.set(productId, quantity);
  }
  if (paymentMethod != null && !["Cash", "Card", "UPI"].includes(paymentMethod)) {
    return res.status(400).json({ message: "Payment method is invalid" });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, merchantId },
        include: {
          items: { include: { product: true } },
          returns: {
            include: {
              items: { include: { saleItem: { include: { product: true } } } },
              processedBy: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!sale) {
        const error = new Error("Sale not found");
        error.statusCode = 404;
        throw error;
      }
      if (sale.paymentStatus !== "PAID") {
        const error = new Error("Only completed sales can be returned");
        error.statusCode = 409;
        throw error;
      }

      const returnedQuantities = new Map();
      let previouslyRefundedCents = 0;
      for (const saleReturn of sale.returns || []) {
        previouslyRefundedCents += cents(saleReturn.total);
        for (const returnedItem of saleReturn.items) {
          returnedQuantities.set(
            returnedItem.saleItemId,
            (returnedQuantities.get(returnedItem.saleItemId) || 0) + returnedItem.quantity
          );
        }
      }

      const saleItemsById = new Map(sale.items.map((item) => [item.id, item]));
      for (const [saleItemId, quantity] of requestedByItemId) {
        const saleItem = saleItemsById.get(saleItemId);
        const alreadyReturned = returnedQuantities.get(saleItemId) || 0;
        if (!saleItem || quantity > saleItem.quantity - alreadyReturned) {
          const error = new Error("Return quantity exceeds the quantity remaining on the sale");
          error.statusCode = 409;
          throw error;
        }
      }

      const saleSubtotal = Number(sale.subtotal) > 0
        ? Number(sale.subtotal)
        : sale.items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
      const saleTotalCents = cents(sale.total);
      if (!Number.isFinite(saleSubtotal) || saleSubtotal <= 0 || !Number.isSafeInteger(saleTotalCents)) {
        const error = new Error("Sale totals are invalid; this sale cannot be returned");
        error.statusCode = 409;
        throw error;
      }

      const allItemsReturned = sale.items.every((item) => (
        (returnedQuantities.get(item.id) || 0) + (requestedByItemId.get(item.id) || 0) >= item.quantity
      ));

      const returnItems = [];
      for (const [saleItemId, quantity] of requestedByItemId) {
        const saleItem = saleItemsById.get(saleItemId);
        const previousQuantity = returnedQuantities.get(saleItemId) || 0;
        const returnedBeforeCents = Math.round(
          saleTotalCents * Number(saleItem.price) * previousQuantity / saleSubtotal
        );
        const returnedAfterCents = Math.round(
          saleTotalCents * Number(saleItem.price) * (previousQuantity + quantity) / saleSubtotal
        );
        returnItems.push({
          saleItemId,
          quantity,
          refundCents: Math.max(0, returnedAfterCents - returnedBeforeCents),
        });
      }

      if (allItemsReturned) {
        const remainingRefundCents = saleTotalCents - previouslyRefundedCents;
        const allocatedCents = returnItems.reduce((sum, item) => sum + item.refundCents, 0);
        let adjustment = remainingRefundCents - allocatedCents;
        for (const item of returnItems) {
          if (adjustment >= 0) {
            item.refundCents += adjustment;
            adjustment = 0;
            break;
          }
          const reduction = Math.min(item.refundCents, -adjustment);
          item.refundCents -= reduction;
          adjustment += reduction;
        }
        if (adjustment !== 0) {
          const error = new Error("The return amount could not be calculated from this sale");
          error.statusCode = 409;
          throw error;
        }
      }

      if (
        returnItems.some((item) => item.refundCents < 0) ||
        returnItems.reduce((sum, item) => sum + item.refundCents, 0) >
          saleTotalCents - previouslyRefundedCents
      ) {
        const error = new Error("The return amount could not be calculated from this sale");
        error.statusCode = 409;
        throw error;
      }

      const refundCents = returnItems.reduce((sum, item) => sum + item.refundCents, 0);
      const replacementProducts = requestedByProductId.size
        ? await tx.product.findMany({
          where: { id: { in: [...requestedByProductId.keys()] } },
        })
        : [];
      if (replacementProducts.length !== requestedByProductId.size) {
        const error = new Error("One or more replacement products were not found");
        error.statusCode = 404;
        throw error;
      }

      const productsById = new Map(replacementProducts.map((product) => [product.id, product]));
      const exchangeItems = [...requestedByProductId].map(([productId, quantity]) => {
        const product = productsById.get(productId);
        const priceCents = cents(product.sellingPrice);
        if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
          const error = new Error("A replacement product has an invalid selling price");
          error.statusCode = 409;
          throw error;
        }
        return {
          productId,
          quantity,
          priceCents,
          amountCents: priceCents * quantity,
        };
      });

      const replacementTotalCents = exchangeItems.reduce(
        (sum, item) => sum + item.amountCents,
        0
      );
      if (!Number.isSafeInteger(replacementTotalCents)) {
        const error = new Error("Replacement total is outside the supported range");
        error.statusCode = 400;
        throw error;
      }

      const settlementCents = replacementTotalCents - refundCents;
      if (settlementCents > 0 && (!paymentMethod || !paymentReceived)) {
        const error = new Error("Collect the balance due and confirm the payment method before recording the exchange");
        error.statusCode = 400;
        throw error;
      }

      const stockDeltas = new Map();
      for (const item of returnItems) {
        const productId = saleItemsById.get(item.saleItemId).productId;
        stockDeltas.set(productId, (stockDeltas.get(productId) || 0) + item.quantity);
      }
      for (const item of exchangeItems) {
        stockDeltas.set(
          item.productId,
          (stockDeltas.get(item.productId) || 0) - item.quantity
        );
      }

      const restockedProducts = [];
      for (const [productId, delta] of stockDeltas) {
        if (!delta) continue;
        const stockUpdate = await tx.product.updateMany({
          where: {
            id: productId,
            ...(delta < 0 ? { stock: { gte: -delta } } : {}),
          },
          data: { stock: { increment: delta } },
        });
        if (stockUpdate.count !== 1) {
          const product = productsById.get(productId);
          const error = new Error(
            product ? `Insufficient stock for ${product.name}` : "A returned product could not be restocked"
          );
          error.statusCode = 409;
          throw error;
        }
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (product) restockedProducts.push(product);
      }

      const saleReturn = await tx.saleReturn.create({
        data: {
          saleId,
          merchantId,
          processedById,
          total: (refundCents / 100).toFixed(2),
          replacementTotal: (replacementTotalCents / 100).toFixed(2),
          settlementAmount: (settlementCents / 100).toFixed(2),
          paymentMethod: settlementCents > 0 ? paymentMethod : null,
          items: {
            create: returnItems.map((item) => ({
              saleItemId: item.saleItemId,
              quantity: item.quantity,
              refundAmount: (item.refundCents / 100).toFixed(2),
            })),
          },
          exchangeItems: {
            create: exchangeItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: (item.priceCents / 100).toFixed(2),
              amount: (item.amountCents / 100).toFixed(2),
            })),
          },
        },
        include: {
          items: { include: { saleItem: { include: { product: true } } } },
          exchangeItems: { include: { product: true } },
          processedBy: { select: { id: true, name: true } },
        },
      });

      return {
        sale: {
          ...sale,
          returns: [...(sale.returns || []), saleReturn],
        },
        saleReturn,
        restockedProducts,
      };
    }, { isolationLevel: "Serializable" });

    await Promise.all(result.restockedProducts.map((product) => (
      product.stock > LOW_STOCK_THRESHOLD
        ? resolveLowStock(db, product.id)
        : notifyLowStock(db, product, merchantId)
    )));

    return res.status(201).json({
      message: "Return recorded",
      sale: result.sale,
      saleReturn: result.saleReturn,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    if (error.code === "P2034") {
      return res.status(409).json({ message: "This sale was updated by another return. Refresh and try again." });
    }
    console.error("Create sale return failed:", error);
    return res.status(500).json({ message: "Failed to process sale return" });
  }
};

module.exports = {
  createSaleReturn: createSaleReturnHandler(),
  createSaleReturnHandler,
};
