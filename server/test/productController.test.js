const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createGetProductByBarcodeHandler,
  createGetBarcodeCatalogHandler,
} = require("../controllers/productController");

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

test("looks up a barcode as a string and preserves leading zeros", async () => {
  let query;
  const product = { id: 1, barcode: "000123", name: "Test product", stock: 4 };
  const handler = createGetProductByBarcodeHandler({
    product: {
      findUnique: async (args) => {
        query = args;
        return product;
      },
    },
  });
  const response = makeResponse();

  await handler({ params: { barcode: "000123" } }, response);

  assert.deepEqual(query, { where: { barcode: "000123" } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, product);
});

test("returns 404 when no product has the requested barcode", async () => {
  const handler = createGetProductByBarcodeHandler({
    product: { findUnique: async () => null },
  });
  const response = makeResponse();

  await handler({ params: { barcode: "8901234567890" } }, response);

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.message, "Product not found for barcode: 8901234567890");
});

test("rejects an empty barcode without querying the database", async () => {
  const handler = createGetProductByBarcodeHandler({
    product: { findUnique: async () => assert.fail("Database should not be queried") },
  });
  const response = makeResponse();

  await handler({ params: { barcode: "   " } }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, "Barcode is required");
});

test("returns 500 when the product lookup fails", async () => {
  const handler = createGetProductByBarcodeHandler({
    product: { findUnique: async () => { throw new Error("database unavailable"); } },
  });
  const response = makeResponse();
  const originalError = console.error;
  console.error = () => {};
  try {
    await handler({ params: { barcode: "123" } }, response);
  } finally {
    console.error = originalError;
  }

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.message, "Failed to look up product barcode");
});

test("returns the product name and broad category from Open Food Facts", async () => {
  let requestedUrl;
  const handler = createGetBarcodeCatalogHandler(async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      json: async () => ({
        status: 1,
        product: {
          product_name_en: "Test biscuits",
          product_name: "Biscuits",
          categories: "Snacks, Sweet snacks, Biscuits",
        },
      }),
    };
  });
  const response = makeResponse();

  await handler({ params: { barcode: "00012345" } }, response);

  assert.match(requestedUrl, /\/product\/00012345\.json\?/);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    barcode: "00012345",
    name: "Test biscuits",
    category: "Snacks",
  });
});

test("uses Uncategorized when the catalog product has no category", async () => {
  const handler = createGetBarcodeCatalogHandler(async () => ({
    ok: true,
    json: async () => ({
      status: 1,
      product: { product_name: "Test item" },
    }),
  }));
  const response = makeResponse();

  await handler({ params: { barcode: "12345678" } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.category, "Uncategorized");
});

test("returns 404 when no matching catalog product exists", async () => {
  const handler = createGetBarcodeCatalogHandler(async () => ({
    ok: true,
    json: async () => ({ status: 0 }),
  }));
  const response = makeResponse();

  await handler({ params: { barcode: "12345678" } }, response);

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.message, "No product details were found for this barcode");
});

test("rejects catalog lookups for non-numeric barcodes", async () => {
  const handler = createGetBarcodeCatalogHandler(async () => {
    assert.fail("Catalog should not be queried for a non-numeric barcode");
  });
  const response = makeResponse();

  await handler({ params: { barcode: "SKU-123" } }, response);

  assert.equal(response.statusCode, 400);
});
