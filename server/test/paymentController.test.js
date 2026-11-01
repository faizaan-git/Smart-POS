const test = require("node:test");
const assert = require("node:assert/strict");
const { createPaymentController } = require("../controllers/paymentController");
const { requireRole } = require("../middleware/authMiddleware");

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const makeDatabase = () => {
  const state = {
    payment: {
      id: 7,
      merchantId: 1,
      saleId: 11,
      amount: "10.00",
      status: "PENDING",
      utrNumber: null,
      expiresAt: new Date(Date.now() + 60_000),
      sale: {
        id: 11,
        merchantId: 1,
        paymentMethod: "UPI",
        paymentStatus: "PENDING",
        total: 10,
        items: [{
          productId: 3,
          quantity: 1,
          product: { id: 3, name: "Coffee", stock: 20 },
        }],
      },
    },
    sale: {
      id: 11,
      merchantId: 1,
      paymentStatus: "PENDING",
    },
    stockUpdates: [],
    logs: [],
  };

  const findPayment = ({ where }) => {
    if (
      where.id !== state.payment.id ||
      where.merchantId !== state.payment.merchantId ||
      (where.status && where.status !== state.payment.status)
    ) {
      return null;
    }

    return {
      ...state.payment,
      sale: {
        ...state.payment.sale,
        paymentStatus: state.sale.paymentStatus,
      },
    };
  };

  const tx = {
    payment: {
      findFirst: async (args) => findPayment(args),
      updateMany: async ({ where, data }) => {
        if (where.id !== state.payment.id || where.merchantId !== state.payment.merchantId) {
          return { count: 0 };
        }
        if (where.status && where.status !== state.payment.status) return { count: 0 };
        Object.assign(state.payment, data);
        return { count: 1 };
      },
    },
    sale: {
      updateMany: async ({ where, data }) => {
        if (
          where.id !== state.sale.id ||
          where.merchantId !== state.sale.merchantId ||
          where.paymentStatus !== state.sale.paymentStatus
        ) {
          return { count: 0 };
        }
        Object.assign(state.sale, data);
        return { count: 1 };
      },
    },
    product: {
      updateMany: async (args) => {
        state.stockUpdates.push(args);
        return { count: 1 };
      },
    },
    pOSSettings: {
      findFirst: async () => ({ allowNegativeStock: false }),
    },
    paymentVerificationLog: {
      create: async ({ data }) => {
        state.logs.push(data);
        return data;
      },
    },
  };

  const db = {
    state,
    payment: {
      findFirst: async (args) => findPayment(args),
    },
    user: {
      findMany: async () => [{ id: 1 }],
    },
    notification: {
      createMany: async () => {},
      upsert: async () => {},
    },
    $transaction: async (work) => work(tx),
  };

  return db;
};

test("admin verification and rejection endpoints are no longer exposed", () => {
  const controller = createPaymentController(makeDatabase());
  assert.equal(controller.verifyPayment, undefined);
  assert.equal(controller.rejectPayment, undefined);
  assert.equal(controller.confirmSoundboxPayment, undefined);
  assert.equal(typeof controller.approvePayment, "function");
});

test("payment approval cannot proceed after the payment has been processed", async () => {
  const db = makeDatabase();
  const { approvePayment } = createPaymentController(db);
  db.state.payment.status = "SUCCESS";
  const response = makeResponse();

  await approvePayment(
    {
      params: { id: "7" },
      user: { id: 1, merchantId: 1, role: "CASHIER" },
      body: {},
    },
    response
  );

  assert.equal(response.statusCode, 409);
  assert.equal(db.state.payment.status, "SUCCESS");
  assert.equal(db.state.sale.paymentStatus, "PENDING");
  assert.equal(db.state.stockUpdates.length, 0);
});

test("staff approval records audit data and completes the bill once", async () => {
  const db = makeDatabase();
  const { approvePayment } = createPaymentController(db);
  const response = makeResponse();

  await approvePayment(
    {
      params: { id: "7" },
      user: { id: 1, merchantId: 1, role: "CASHIER" },
      body: {},
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(db.state.payment.status, "SUCCESS");
  assert.equal(db.state.payment.verifiedBy, 1);
  assert.equal(db.state.payment.verifiedAmount, "10.00");
  assert.equal(db.state.payment.utrNumber, null);
  assert.ok(db.state.payment.verifiedAt instanceof Date);
  assert.equal(db.state.sale.paymentStatus, "PAID");
  assert.equal(db.state.stockUpdates.length, 1);
  assert.equal(db.state.logs[0].action, "APPROVED");
  assert.equal(db.state.logs[0].amount, "10.00");
  assert.match(db.state.logs[0].notes, /confirming receipt/);

  const duplicateResponse = makeResponse();
  await approvePayment(
    {
      params: { id: "7" },
      user: { id: 1, merchantId: 1, role: "CASHIER" },
      body: {},
    },
    duplicateResponse
  );
  assert.equal(duplicateResponse.statusCode, 409);
  assert.equal(db.state.stockUpdates.length, 1);
});

test("approval rejects mismatched stored bill and payment amounts", async () => {
  const db = makeDatabase();
  db.state.payment.amount = "9.99";
  const { approvePayment } = createPaymentController(db);
  const response = makeResponse();

  await approvePayment(
    {
      params: { id: "7" },
      user: { id: 1, merchantId: 1, role: "CASHIER" },
      body: {},
    },
    response
  );

  assert.equal(response.statusCode, 409);
  assert.equal(db.state.payment.status, "PENDING");
  assert.equal(db.state.sale.paymentStatus, "PENDING");
  assert.equal(db.state.stockUpdates.length, 0);
});

test("merchant-scoped payment lookup does not reveal another merchant's transaction", async () => {
  const db = makeDatabase();
  const { getPayment } = createPaymentController(db);
  const response = makeResponse();

  await getPayment(
    { params: { id: "7" }, user: { id: 44, merchantId: 2 } },
    response
  );

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.message, "Payment not found");
});

test("expired requests stop being pending and their bills stay unpaid", async () => {
  const db = makeDatabase();
  db.state.payment.expiresAt = new Date(Date.now() - 60_000);
  const { getPayment } = createPaymentController(db);
  const response = makeResponse();

  await getPayment(
    { params: { id: "7" }, user: { id: 22, merchantId: 1 } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "EXPIRED");
  assert.equal(db.state.sale.paymentStatus, "FAILED");
  assert.equal(db.state.stockUpdates.length, 0);
});

test("authorized billing roles can approve a payment", () => {
  const response = makeResponse();
  let continued = false;
  const middleware = requireRole("ADMIN", "MANAGER", "CASHIER");

  middleware({ user: { id: 22, role: "CASHIER", merchantId: 1 } }, response, () => {
    continued = true;
  });

  assert.equal(response.statusCode, 200);
  assert.equal(continued, true);

  const adminResponse = makeResponse();
  let adminContinued = false;
  middleware({ user: { id: 1, role: "ADMIN", merchantId: 1 } }, adminResponse, () => {
    adminContinued = true;
  });
  assert.equal(adminResponse.statusCode, 200);
  assert.equal(adminContinued, true);
});
