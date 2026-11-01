const test = require("node:test");
const assert = require("node:assert/strict");
const { createSaleHandler } = require("../controllers/saleController");

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

const makeDatabase = ({
  products = [{ id: 5, sellingPrice: 8.5, stock: 10 }],
  settings = {
    allowNegativeStock: false,
    requireCustomer: false,
    enableTax: false,
    enableDiscount: false,
    currency: "INR",
    invoicePrefix: "INV-",
    startingInvoiceNo: 1001,
  },
  stockUpdateCount = 1,
  customer = { id: 9 },
  paymentSettings = {
    enabled: true,
    upiId: "shop@bank",
    upiDisplayName: "Smart POS Shop",
    paymentInstructions: "Pay exact amount",
    qrExpirationMinutes: 10,
  },
} = {}) => {
  const state = {
    transactionCalls: 0,
    stockUpdates: [],
    createdSale: null,
    createdPayment: null,
    notifications: [],
  };

  const tx = {
    product: {
      findMany: async () => products,
      updateMany: async (args) => {
        state.stockUpdates.push(args);
        return { count: stockUpdateCount };
      },
    },
    pOSSettings: {
      findFirst: async () => settings,
    },
    customer: {
      findUnique: async () => customer,
    },
    merchantPaymentSettings: {
      findUnique: async () => paymentSettings,
    },
    payment: {
      create: async ({ data }) => {
        state.createdPayment = {
          id: 1,
          ...data,
          status: "PENDING",
          sale: { id: 1, ...state.createdSale },
        };
        return state.createdPayment;
      },
      findUnique: async () => null,
    },
    sale: {
      create: async ({ data }) => {
        state.createdSale = data;
        return { id: 1, ...data };
      },
      update: async ({ where, data }) => {
        state.createdSale = { ...state.createdSale, ...data };
        return { id: where.id, ...state.createdSale };
      },
    },
  };

  return {
    state,
    payment: {
      findUnique: async ({ where }) => (
        state.createdPayment?.idempotencyKey === where.idempotencyKey
          ? state.createdPayment
          : null
      ),
    },
    user: {
      findMany: async () => [{ id: 1 }, { id: 2 }],
    },
    notification: {
      createMany: async ({ data }) => {
        state.notifications.push(...data);
      },
      upsert: async ({ create }) => {
        state.notifications.push(create);
      },
    },
    $transaction: async (work) => {
      state.transactionCalls += 1;
      return work(tx);
    },
  };
};

test("creates sales at stored prices and decrements stock in one transaction", async () => {
  const db = makeDatabase();
  const response = makeResponse();
  const handler = createSaleHandler(db);

  await handler(
    {
      body: {
        cart: [
          { id: 5, qty: 1, sellingPrice: 0.01 },
          { id: 5, qty: 1, sellingPrice: 0.01 },
        ],
        total: 0.02,
        paymentMethod: "Cash",
        cashReceived: 20,
      },
      user: { id: 8, role: "CASHIER", merchantId: 1 },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.equal(db.state.transactionCalls, 1);
  assert.equal(db.state.createdSale.total, 17);
  assert.equal(db.state.createdSale.subtotal, 17);
  assert.equal(db.state.createdSale.taxAmount, 0);
  assert.equal(db.state.createdSale.discountAmount, 0);
  assert.equal(db.state.createdSale.roundingAmount, 0);
  assert.equal(db.state.createdSale.currency, "INR");
  assert.deepEqual(db.state.createdSale.items.create, [
    { productId: 5, quantity: 2, price: 8.5 },
  ]);
  assert.deepEqual(db.state.stockUpdates[0], {
    where: { id: 5, stock: { gte: 2 } },
    data: { stock: { decrement: 2 } },
  });
  assert.equal(db.state.createdPayment, null);
});

test("records the cashier and creates sale plus threshold-crossing stock notifications", async () => {
  const db = makeDatabase({
    products: [{ id: 5, name: "Coffee", sellingPrice: 8.5, stock: 11 }],
  });
  const response = makeResponse();
  const handler = createSaleHandler(db);

  await handler(
    {
      user: { id: 8, role: "CASHIER", merchantId: 1 },
      body: { cart: [{ id: 5, qty: 2 }], paymentMethod: "Card" },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.equal(db.state.createdSale.cashierId, 8);
  assert.equal(db.state.createdPayment, null);
  assert.equal(db.state.notifications.length, 5);
  assert.equal(db.state.notifications.filter((item) => item.category === "SALE").length, 3);
  assert.equal(db.state.notifications.filter((item) => item.category === "LOW_STOCK").length, 2);
  assert.match(
    db.state.notifications.find((item) => item.category === "LOW_STOCK").message,
    /Coffee has only 9 units/
  );
});

test("rejects invalid quantities before opening a transaction", async () => {
  const db = makeDatabase();
  const response = makeResponse();
  const handler = createSaleHandler(db);

  await handler({
    user: { id: 8, merchantId: 1 },
    body: { cart: [{ id: 5, qty: 0 }] },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(db.state.transactionCalls, 0);
});

test("rejects insufficient inventory without creating a sale", async () => {
  const db = makeDatabase({ stockUpdateCount: 0 });
  const response = makeResponse();
  const handler = createSaleHandler(db);

  await handler(
    {
      user: { id: 8, merchantId: 1 },
      body: { cart: [{ id: 5, qty: 11 }], paymentMethod: "Card" },
    },
    response
  );

  assert.equal(response.statusCode, 409);
  assert.equal(db.state.createdSale, null);
});

test("applies discount to GST-inclusive prices and assigns the configured invoice number", async () => {
  const db = makeDatabase({
    settings: {
      allowNegativeStock: false,
      requireCustomer: false,
      enableTax: true,
      defaultTaxRate: 18,
      enableDiscount: true,
      defaultDiscount: 10,
      currency: "USD",
      invoicePrefix: "SHOP-",
      startingInvoiceNo: 500,
    },
  });
  const response = makeResponse();
  const handler = createSaleHandler(db);

  await handler(
    {
      body: {
        cart: [{ id: 5, qty: 2 }],
        paymentMethod: "Cash",
        cashReceived: 20,
      },
      user: { id: 8, role: "CASHIER", merchantId: 1 },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.equal(db.state.createdSale.subtotal, 17);
  assert.equal(db.state.createdSale.discountRate, 10);
  assert.equal(db.state.createdSale.discountAmount, 1.7);
  assert.equal(db.state.createdSale.taxRate, 18);
  assert.equal(db.state.createdSale.taxAmount, 2.33);
  assert.equal(db.state.createdSale.total, 16);
  assert.equal(db.state.createdSale.roundingAmount, 0.7);
  assert.equal(db.state.createdSale.currency, "USD");
  assert.equal(response.body.sale.invoiceNumber, "SHOP-500");
});

test("rounds a fractional payable amount up to the next whole currency unit", async () => {
  const db = makeDatabase({
    settings: {
      allowNegativeStock: false,
      requireCustomer: false,
      enableTax: true,
      defaultTaxRate: 18,
      enableDiscount: false,
      defaultDiscount: 0,
      currency: "INR",
    },
  });
  const response = makeResponse();
  const handler = createSaleHandler(db);

  await handler(
    {
      body: {
        cart: [{ id: 5, qty: 1 }],
        paymentMethod: "Cash",
        cashReceived: 11,
      },
      user: { id: 8, role: "CASHIER", merchantId: 1 },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.equal(db.state.createdSale.subtotal, 8.5);
  assert.equal(db.state.createdSale.taxAmount, 1.3);
  assert.equal(db.state.createdSale.total, 9);
  assert.equal(db.state.createdSale.roundingAmount, 0.5);
});

test("rejects out-of-range configured tax rates without recording a sale", async () => {
  const db = makeDatabase({
    settings: {
      allowNegativeStock: false,
      requireCustomer: false,
      enableTax: true,
      defaultTaxRate: 101,
      enableDiscount: false,
    },
  });
  const response = makeResponse();
  const handler = createSaleHandler(db);

  await handler(
    {
      user: { id: 8, merchantId: 1 },
      body: { cart: [{ id: 5, qty: 1 }], paymentMethod: "Card" },
    },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(db.state.createdSale, null);
});

test("validates cash received against the rounded GST-inclusive amount due", async () => {
  const db = makeDatabase({
    settings: {
      allowNegativeStock: false,
      requireCustomer: false,
      enableTax: true,
      defaultTaxRate: 18,
      enableDiscount: false,
      defaultDiscount: 0,
      currency: "INR",
    },
  });
  const response = makeResponse();
  const handler = createSaleHandler(db);

  await handler(
    {
      body: {
        cart: [{ id: 5, qty: 1 }],
        paymentMethod: "Cash",
        cashReceived: 8,
      },
      user: { id: 8, role: "CASHIER", merchantId: 1 },
    },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(db.state.createdSale, null);
  assert.equal(db.state.stockUpdates.length, 0);
});

test("applies the configured required-customer rule", async () => {
  const db = makeDatabase({
    settings: { allowNegativeStock: false, requireCustomer: true },
  });
  const response = makeResponse();
  const handler = createSaleHandler(db);

  await handler(
    {
      user: { id: 8, merchantId: 1 },
      body: { cart: [{ id: 5, qty: 1 }], paymentMethod: "Card" },
    },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(db.state.createdSale, null);
});

test("UPI creates a fixed-amount pending QR without completing the sale or decrementing stock", async () => {
  const db = makeDatabase();
  const response = makeResponse();
  const handler = createSaleHandler(db, { upiOnly: true });

  await handler(
    {
      user: { id: 8, role: "CASHIER", merchantId: 1 },
      body: {
        cart: [{ id: 5, qty: 2 }],
        paymentMethod: "UPI",
        total: 0.01,
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
      },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.equal(db.state.createdSale.total, 17);
  assert.equal(db.state.createdSale.paymentStatus, "PENDING");
  assert.equal(db.state.createdSale.merchantId, 1);
  assert.equal(db.state.createdPayment.amount, "17.00");
  assert.equal(db.state.createdPayment.status, "PENDING");
  assert.equal(db.state.stockUpdates.length, 0);
  assert.match(response.body.payment.qrCodeDataUrl, /^data:image\/png;base64,/);

  const uri = new URL(response.body.payment.paymentUri);
  assert.equal(uri.protocol, "upi:");
  assert.equal(uri.searchParams.get("pa"), "shop@bank");
  assert.equal(uri.searchParams.get("pn"), "Smart POS Shop");
  assert.equal(uri.searchParams.get("am"), "17.00");
  assert.equal(uri.searchParams.get("cu"), "INR");
  assert.equal(uri.searchParams.get("tn"), db.state.createdPayment.transactionReference);

  const retryResponse = makeResponse();
  await handler(
    {
      user: { id: 8, role: "CASHIER", merchantId: 1 },
      body: {
        cart: [{ id: 5, qty: 2 }],
        paymentMethod: "UPI",
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
      },
    },
    retryResponse
  );
  assert.equal(retryResponse.statusCode, 200);
  assert.equal(db.state.transactionCalls, 1);
});

test("the ordinary sales endpoint refuses UPI so it cannot bypass verification", async () => {
  const db = makeDatabase();
  const response = makeResponse();
  const handler = createSaleHandler(db);

  await handler(
    {
      user: { id: 8, role: "CASHIER", merchantId: 1 },
      body: { cart: [{ id: 5, qty: 1 }], paymentMethod: "UPI" },
    },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(db.state.transactionCalls, 0);
  assert.equal(db.state.createdSale, null);
});

test("UPI creation is rejected when the merchant has disabled it", async () => {
  const db = makeDatabase({ paymentSettings: { enabled: false } });
  const response = makeResponse();
  const handler = createSaleHandler(db, { upiOnly: true });

  await handler(
    {
      user: { id: 8, role: "CASHIER", merchantId: 1 },
      body: {
        cart: [{ id: 5, qty: 1 }],
        paymentMethod: "UPI",
        idempotencyKey: "00000000-0000-4000-8000-000000000002",
      },
    },
    response
  );

  assert.equal(response.statusCode, 409);
  assert.equal(db.state.createdSale, null);
  assert.equal(db.state.stockUpdates.length, 0);
});
