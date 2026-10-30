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
} = {}) => {
  const state = {
    transactionCalls: 0,
    stockUpdates: [],
    createdSale: null,
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
    sale: {
      create: async ({ data }) => {
        state.createdSale = data;
        return { id: 1, ...data };
      },
      update: async ({ where, data }) => ({
        id: where.id,
        ...state.createdSale,
        ...data,
      }),
    },
  };

  return {
    state,
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
});

test("records the cashier and creates sale plus threshold-crossing stock notifications", async () => {
  const db = makeDatabase({
    products: [{ id: 5, name: "Coffee", sellingPrice: 8.5, stock: 11 }],
  });
  const response = makeResponse();
  const handler = createSaleHandler(db);

  await handler(
    {
      user: { id: 8, role: "CASHIER" },
      body: { cart: [{ id: 5, qty: 2 }], paymentMethod: "Card" },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.equal(db.state.createdSale.cashierId, 8);
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

  await handler({ body: { cart: [{ id: 5, qty: 0 }] } }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(db.state.transactionCalls, 0);
});

test("rejects insufficient inventory without creating a sale", async () => {
  const db = makeDatabase({ stockUpdateCount: 0 });
  const response = makeResponse();
  const handler = createSaleHandler(db);

  await handler(
    { body: { cart: [{ id: 5, qty: 11 }], paymentMethod: "Card" } },
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
    { body: { cart: [{ id: 5, qty: 1 }], paymentMethod: "Card" } },
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
    { body: { cart: [{ id: 5, qty: 1 }], paymentMethod: "Card" } },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(db.state.createdSale, null);
});
