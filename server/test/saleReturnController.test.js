const test = require("node:test");
const assert = require("node:assert/strict");
const { createSaleReturnHandler } = require("../controllers/saleReturnController");

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
  sale = {
    id: 12,
    merchantId: 3,
    paymentStatus: "PAID",
    subtotal: 200,
    total: 180,
    items: [{ id: 31, productId: 8, quantity: 2, price: 100 }],
    returns: [],
  },
} = {}) => {
  const state = {
    stockUpdates: [],
    productStocks: new Map([[8, 10], [9, 20]]),
    createdReturn: null,
    transactionOptions: null,
    resolvedLowStockProductIds: [],
    lowStockNotifications: [],
  };
  const tx = {
    sale: {
      findFirst: async () => sale,
    },
    product: {
      findMany: async ({ where }) => where.id.in.map((id) => ({
        id,
        name: id === 8 ? "Original product" : "Replacement product",
        sellingPrice: id === 8 ? 100 : 150,
      })),
      findUnique: async ({ where }) => ({
        id: where.id,
        name: where.id === 8 ? "Original product" : "Replacement product",
        stock: state.productStocks.get(where.id),
      }),
      updateMany: async (args) => {
        state.stockUpdates.push(args);
        const currentStock = state.productStocks.get(args.where.id);
        const minimumStock = args.where.stock?.gte ?? 0;
        if (currentStock < minimumStock) return { count: 0 };
        state.productStocks.set(
          args.where.id,
          currentStock + args.data.stock.increment
        );
        return { count: 1 };
      },
    },
    saleReturn: {
      create: async ({ data, include }) => {
        state.createdReturn = {
          id: 45,
          ...data,
          items: data.items.create,
          exchangeItems: data.exchangeItems.create,
        };
        return state.createdReturn;
      },
    },
  };
  return {
    state,
    notification: {
      updateMany: async ({ where }) => {
        state.resolvedLowStockProductIds.push(where.relatedId);
      },
      upsert: async ({ create }) => {
        state.lowStockNotifications.push(create);
      },
    },
    user: {
      findMany: async () => [{ id: 2 }],
    },
    $transaction: async (work, options) => {
      state.transactionOptions = options;
      return work(tx);
    },
  };
};

const makeRequest = (items) => ({
  params: { saleId: "12" },
  user: { id: 6, merchantId: 3, role: "MANAGER" },
  body: { items },
});

test("records a partial return, calculates its prorated refund, and restocks returned items", async () => {
  const db = makeDatabase();
  const response = makeResponse();
  await createSaleReturnHandler(db)(makeRequest([{ saleItemId: 31, quantity: 1 }]), response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.saleReturn.total, "90.00");
  assert.deepEqual(response.body.saleReturn.items, [{
    saleItemId: 31,
    quantity: 1,
    refundAmount: "90.00",
  }]);
  assert.deepEqual(db.state.stockUpdates, [{
    where: { id: 8 },
    data: { stock: { increment: 1 } },
  }]);
  assert.equal(db.state.createdReturn.processedById, 6);
  assert.equal(db.state.transactionOptions.isolationLevel, "Serializable");
  assert.deepEqual(db.state.resolvedLowStockProductIds, [8]);
  assert.equal(db.state.lowStockNotifications.length, 0);
});

test("records an exchange and requires confirmed payment for a positive balance", async () => {
  const db = makeDatabase();
  const response = makeResponse();
  const request = makeRequest([{ saleItemId: 31, quantity: 1 }]);
  request.body.replacements = [{ productId: 9, quantity: 1 }];
  request.body.paymentMethod = "UPI";
  request.body.paymentReceived = true;
  await createSaleReturnHandler(db)(request, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.saleReturn.total, "90.00");
  assert.equal(response.body.saleReturn.replacementTotal, "150.00");
  assert.equal(response.body.saleReturn.settlementAmount, "60.00");
  assert.equal(response.body.saleReturn.paymentMethod, "UPI");
  assert.deepEqual(response.body.saleReturn.exchangeItems, [{
    productId: 9,
    quantity: 1,
    price: "150.00",
    amount: "150.00",
  }]);
  assert.deepEqual(db.state.stockUpdates, [
    { where: { id: 8 }, data: { stock: { increment: 1 } } },
    { where: { id: 9, stock: { gte: 1 } }, data: { stock: { increment: -1 } } },
  ]);
});

test("does not record or restock an exchange until its balance is confirmed paid", async () => {
  const db = makeDatabase();
  const response = makeResponse();
  const request = makeRequest([{ saleItemId: 31, quantity: 1 }]);
  request.body.replacements = [{ productId: 9, quantity: 1 }];
  request.body.paymentMethod = "Card";
  await createSaleReturnHandler(db)(request, response);

  assert.equal(response.statusCode, 400);
  assert.equal(db.state.stockUpdates.length, 0);
  assert.equal(db.state.createdReturn, null);
});

test("caps the final return refund at the original paid total", async () => {
  const db = makeDatabase({
    sale: {
      id: 12,
      merchantId: 3,
      paymentStatus: "PAID",
      subtotal: 200,
      total: 180,
      items: [{ id: 31, productId: 8, quantity: 2, price: 100 }],
      returns: [{
        total: "90.00",
        items: [{ saleItemId: 31, quantity: 1 }],
      }],
    },
  });
  const response = makeResponse();
  await createSaleReturnHandler(db)(makeRequest([{ saleItemId: 31, quantity: 1 }]), response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.saleReturn.total, "90.00");
});

test("rejects quantities above the remaining sold quantity without changing stock", async () => {
  const db = makeDatabase({
    sale: {
      id: 12,
      merchantId: 3,
      paymentStatus: "PAID",
      subtotal: 200,
      total: 180,
      items: [{ id: 31, productId: 8, quantity: 2, price: 100 }],
      returns: [{
        total: "90.00",
        items: [{ saleItemId: 31, quantity: 1 }],
      }],
    },
  });
  const response = makeResponse();
  await createSaleReturnHandler(db)(makeRequest([{ saleItemId: 31, quantity: 2 }]), response);

  assert.equal(response.statusCode, 409);
  assert.deepEqual(db.state.stockUpdates, []);
  assert.equal(db.state.createdReturn, null);
});

test("rejects empty or duplicate return item selections", async () => {
  const db = makeDatabase();
  const handler = createSaleReturnHandler(db);

  const emptyResponse = makeResponse();
  await handler(makeRequest([]), emptyResponse);
  assert.equal(emptyResponse.statusCode, 400);

  const duplicateResponse = makeResponse();
  await handler(
    makeRequest([
      { saleItemId: 31, quantity: 1 },
      { saleItemId: 31, quantity: 1 },
    ]),
    duplicateResponse
  );
  assert.equal(duplicateResponse.statusCode, 400);
});
