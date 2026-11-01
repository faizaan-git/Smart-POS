const prisma = require("../prisma/client");
const { notifyLowStock, notifySaleCompleted } = require("../services/notificationService");

const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}$/;

const merchantIdFor = (req) => Number(req.user?.merchantId);

const createPaymentController = (db = prisma) => {
  const getPaymentSettings = async (req, res) => {
    try {
      const merchantId = merchantIdFor(req);
      if (!Number.isSafeInteger(merchantId) || merchantId < 1) {
        return res.status(403).json({ message: "Your account is not associated with a merchant" });
      }

      const settings = await db.merchantPaymentSettings.findUnique({
        where: { merchantId },
      });
      res.json(settings || {
        merchantId,
        businessName: "",
        upiId: "",
        upiDisplayName: "",
        accountHolderName: "",
        accountNumber: "",
        ifscCode: "",
        bankName: "",
        paymentInstructions: "",
        enabled: false,
        qrExpirationMinutes: 10,
      });
    } catch (error) {
      console.error("Get merchant payment settings failed:", error);
      res.status(500).json({ message: "Failed to load UPI payment settings" });
    }
  };

  const updatePaymentSettings = async (req, res) => {
    const merchantId = merchantIdFor(req);
    if (!Number.isSafeInteger(merchantId) || merchantId < 1) {
      return res.status(403).json({ message: "Your account is not associated with a merchant" });
    }

    const body = req.body || {};
    const settings = {
      businessName: typeof body.businessName === "string" ? body.businessName.trim() : "",
      upiId: typeof body.upiId === "string" ? body.upiId.trim() : "",
      upiDisplayName: typeof body.upiDisplayName === "string" ? body.upiDisplayName.trim() : "",
      accountHolderName: typeof body.accountHolderName === "string" ? body.accountHolderName.trim() : "",
      accountNumber: typeof body.accountNumber === "string" ? body.accountNumber.replace(/\s/g, "") : "",
      ifscCode: typeof body.ifscCode === "string" ? body.ifscCode.trim().toUpperCase() : "",
      bankName: typeof body.bankName === "string" ? body.bankName.trim() : "",
      paymentInstructions: typeof body.paymentInstructions === "string" ? body.paymentInstructions.trim() : "",
      enabled: body.enabled,
      qrExpirationMinutes: Number(body.qrExpirationMinutes),
    };

    if (
      typeof settings.enabled !== "boolean" ||
      !Number.isInteger(settings.qrExpirationMinutes) ||
      settings.qrExpirationMinutes < 1 ||
      settings.qrExpirationMinutes > 1440 ||
      !settings.businessName ||
      settings.businessName.length > 120 ||
      settings.upiDisplayName.length > 100 ||
      settings.accountHolderName.length > 120 ||
      settings.accountNumber.length > 20 ||
      settings.bankName.length > 120 ||
      settings.paymentInstructions.length > 1000
    ) {
      return res.status(400).json({ message: "Payment settings contain invalid values" });
    }

    if (
      settings.enabled &&
      (!UPI_ID_PATTERN.test(settings.upiId) ||
        !settings.upiDisplayName ||
        !settings.accountHolderName ||
        !/^\d{6,20}$/.test(settings.accountNumber) ||
        !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(settings.ifscCode) ||
        !settings.bankName)
    ) {
      return res.status(400).json({
        message: "Complete valid merchant, UPI ID, and bank account details before enabling UPI",
      });
    }

    if (settings.upiId && !UPI_ID_PATTERN.test(settings.upiId)) {
      return res.status(400).json({ message: "UPI ID is invalid" });
    }
    if (
      (settings.accountNumber && !/^\d{6,20}$/.test(settings.accountNumber)) ||
      (settings.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(settings.ifscCode))
    ) {
      return res.status(400).json({ message: "Bank account number or IFSC code is invalid" });
    }

    try {
      const saved = await db.$transaction(async (tx) => {
        const current = await tx.merchantPaymentSettings.upsert({
          where: { merchantId },
          create: { merchantId, ...settings },
          update: settings,
        });
        await tx.merchant.update({
          where: { id: merchantId },
          data: { name: settings.businessName || "SmartPOS" },
        });
        return current;
      });
      res.json(saved);
    } catch (error) {
      console.error("Update merchant payment settings failed:", error);
      res.status(500).json({ message: "Failed to save UPI payment settings" });
    }
  };

  const paymentInclude = {
    sale: {
      include: {
        customer: true,
        cashier: { select: { id: true, name: true } },
        items: { include: { product: true } },
      },
    },
    verificationLogs: {
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { id: true, name: true } } },
    },
    verifier: { select: { id: true, name: true } },
  };

  const expirePayment = async (payment) => {
    if (payment.status !== "PENDING" || payment.expiresAt > new Date()) {
      return payment;
    }

    await db.$transaction(async (tx) => {
      const expired = await tx.payment.updateMany({
        where: {
          id: payment.id,
          merchantId: payment.merchantId,
          status: "PENDING",
          expiresAt: { lte: new Date() },
        },
        data: { status: "EXPIRED" },
      });
      if (expired.count) {
        await tx.sale.updateMany({
          where: {
            id: payment.saleId,
            merchantId: payment.merchantId,
            paymentStatus: "PENDING",
          },
          data: { paymentStatus: "FAILED" },
        });
      }
    });

    return db.payment.findFirst({
      where: { id: payment.id, merchantId: payment.merchantId },
      include: paymentInclude,
    });
  };

  const expireMerchantPayments = async (merchantId) => {
    const expiredPayments = await db.payment.findMany({
      where: {
        merchantId,
        status: "PENDING",
        expiresAt: { lte: new Date() },
      },
      select: {
        id: true,
        merchantId: true,
        saleId: true,
        status: true,
        expiresAt: true,
      },
    });
    await Promise.all(expiredPayments.map(expirePayment));
  };

  const getPayment = async (req, res) => {
    const id = Number(req.params.id);
    const merchantId = merchantIdFor(req);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ message: "Payment ID is invalid" });
    }

    try {
      let payment = await db.payment.findFirst({
        where: { id, merchantId },
        include: paymentInclude,
      });
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      payment = await expirePayment(payment);
      res.json(payment);
    } catch (error) {
      console.error("Get UPI payment failed:", error);
      res.status(500).json({ message: "Failed to load payment" });
    }
  };

  const approvePayment = async (req, res) => {
    const id = Number(req.params.id);
    const merchantId = merchantIdFor(req);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ message: "Payment ID is invalid" });
    }

    try {
      const pendingPayment = await db.payment.findFirst({
        where: { id, merchantId },
      });
      if (!pendingPayment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      const activePayment = await expirePayment(pendingPayment);
      if (activePayment.status !== "PENDING") {
        return res.status(409).json({ message: "This payment is no longer pending" });
      }

      const lowStockCrossings = [];
      const payment = await db.$transaction(async (tx) => {
        const current = await tx.payment.findFirst({
          where: { id, merchantId },
          include: {
            sale: {
              include: { items: { include: { product: true } } },
            },
          },
        });
        if (!current) {
          const error = new Error("Payment not found");
          error.statusCode = 404;
          throw error;
        }
        if (current.status !== "PENDING") {
          const error = new Error("Payment has already been processed");
          error.statusCode = 409;
          throw error;
        }
        if (current.expiresAt <= new Date()) {
          const error = new Error("Payment QR has expired");
          error.statusCode = 409;
          throw error;
        }
        if (
          current.sale.merchantId !== merchantId ||
          current.sale.paymentStatus !== "PENDING" ||
          current.sale.paymentMethod !== "UPI" ||
          Number(current.sale.total).toFixed(2) !== Number(current.amount).toFixed(2)
        ) {
          const error = new Error("Bill amount does not match the pending payment");
          error.statusCode = 409;
          throw error;
        }

        const posSettings = await tx.pOSSettings.findFirst();
        const allowNegativeStock = posSettings?.allowNegativeStock ?? false;
        for (const item of current.sale.items) {
          const stockUpdate = await tx.product.updateMany({
            where: {
              id: item.productId,
              ...(allowNegativeStock ? {} : { stock: { gte: item.quantity } }),
            },
            data: { stock: { decrement: item.quantity } },
          });
          if (stockUpdate.count !== 1) {
            const error = new Error("Insufficient stock to complete this bill");
            error.statusCode = 409;
            throw error;
          }

          const resultingStock = item.product.stock - item.quantity;
          if (item.product.stock > 10 && resultingStock <= 10) {
            lowStockCrossings.push({
              id: item.product.id,
              name: item.product.name,
              stock: resultingStock,
            });
          }
        }

        const saleUpdate = await tx.sale.updateMany({
          where: { id: current.saleId, merchantId, paymentStatus: "PENDING" },
          data: { paymentStatus: "PAID" },
        });
        const paymentUpdate = await tx.payment.updateMany({
          where: { id, merchantId, status: "PENDING", expiresAt: { gt: new Date() } },
          data: {
            status: "SUCCESS",
            utrNumber: null,
            verifiedAmount: current.amount,
            verifiedAt: new Date(),
            verifiedBy: req.user.id,
          },
        });
        if (!saleUpdate.count || !paymentUpdate.count) {
          const error = new Error("Payment or bill has already been processed");
          error.statusCode = 409;
          throw error;
        }

        await tx.paymentVerificationLog.create({
          data: {
            paymentId: id,
            merchantId,
            actorId: req.user.id,
            action: "APPROVED",
            amount: current.amount,
            notes: "Staff approved the payment after confirming receipt",
          },
        });

        return tx.payment.findFirst({
          where: { id, merchantId },
          include: paymentInclude,
        });
      });

      await Promise.all([
        notifySaleCompleted(db, payment.sale, req.user.id),
        ...lowStockCrossings.map((product) => notifyLowStock(db, product, merchantId)),
      ]);

      return res.json({ message: "Payment approved and bill completed", payment });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Approve UPI payment failed:", error);
      return res.status(500).json({ message: "Failed to approve UPI payment" });
    }
  };
  const listPayments = async (req, res) => {
    const merchantId = merchantIdFor(req);
    const { status, search, startDate, endDate } = req.query;
    const where = { merchantId };
    if (status && !["PENDING", "SUCCESS", "FAILED", "EXPIRED"].includes(status)) {
      return res.status(400).json({ message: "Payment status filter is invalid" });
    }
    if (status) {
      where.status = status;
    }
    if (search) {
      const term = String(search).trim().slice(0, 100);
      if (term) {
        where.OR = [
          { utrNumber: { contains: term, mode: "insensitive" } },
          { transactionReference: { contains: term, mode: "insensitive" } },
          { sale: { invoiceNumber: { contains: term, mode: "insensitive" } } },
        ];
      }
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!Number.isFinite(start.getTime())) {
          return res.status(400).json({ message: "Start date is invalid" });
        }
        start.setHours(0, 0, 0, 0);
        where.createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!Number.isFinite(end.getTime())) {
          return res.status(400).json({ message: "End date is invalid" });
        }
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
      if (
        where.createdAt.gte &&
        where.createdAt.lte &&
        where.createdAt.gte > where.createdAt.lte
      ) {
        return res.status(400).json({ message: "End date must be on or after start date" });
      }
    }

    try {
      await expireMerchantPayments(merchantId);
      const payments = await db.payment.findMany({
        where,
        include: paymentInclude,
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      res.json(payments);
    } catch (error) {
      console.error("List merchant UPI payments failed:", error);
      res.status(500).json({ message: "Failed to load UPI payment history" });
    }
  };

  return {
    getPaymentSettings,
    updatePaymentSettings,
    getPayment,
    approvePayment,
    listPayments,
  };
};

module.exports = {
  ...createPaymentController(),
  createPaymentController,
};
