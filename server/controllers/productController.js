const prisma = require("../prisma/client");
const {
  LOW_STOCK_THRESHOLD,
  notifyLowStock,
  resolveLowStock,
} = require("../services/notificationService");

// Get All Products
const getProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: {
        id: "desc",
      },
    });

    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch products",
    });
  }
};

const createGetProductByBarcodeHandler = (db) => async (req, res) => {
  const barcode = String(req.params.barcode || "").trim();
  if (!barcode) {
    return res.status(400).json({ message: "Barcode is required" });
  }

  try {
    const product = await db.product.findUnique({ where: { barcode } });
    if (!product) {
      return res.status(404).json({ message: `Product not found for barcode: ${barcode}` });
    }
    return res.json(product);
  } catch (error) {
    console.error("Get product by barcode failed:", error);
    return res.status(500).json({ message: "Failed to look up product barcode" });
  }
};

const getProductByBarcode = createGetProductByBarcodeHandler(prisma);

const createGetBarcodeCatalogHandler = (fetchImpl = globalThis.fetch) => async (req, res) => {
  const barcode = String(req.params.barcode || "").trim();
  if (!/^\d{8,14}$/.test(barcode)) {
    return res.status(400).json({ message: "A valid 8-14 digit barcode is required" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  timeout.unref?.();

  try {
    const response = await fetchImpl(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_en,generic_name,generic_name_en,categories`,
      {
        headers: { "User-Agent": "SmartPOS/1.0 (barcode product lookup)" },
        signal: controller.signal,
      }
    );
    if (!response.ok) {
      throw new Error(`Barcode catalog returned HTTP ${response.status}`);
    }

    const result = await response.json();
    const product = result.status === 1 ? result.product : null;
    const name = String(product?.product_name_en
      || product?.product_name
      || product?.generic_name_en
      || product?.generic_name
      || "").trim();

    if (!name) {
      return res.status(404).json({ message: "No product details were found for this barcode" });
    }

    const category = String(product.categories || "")
      .split(",")[0]
      .trim() || "Uncategorized";

    return res.json({ barcode, name, category });
  } catch (error) {
    console.error("Barcode catalog lookup failed:", error);
    return res.status(502).json({ message: "Product catalog lookup failed. Please try again." });
  } finally {
    clearTimeout(timeout);
  }
};

const getBarcodeCatalogProduct = createGetBarcodeCatalogHandler();

// Add Product
const addProduct = async (req, res) => {
  try {
    const {
      name,
      barcode,
      category,
      purchasePrice,
      sellingPrice,
      stock,
    } = req.body;

    const product = await prisma.product.create({
      data: {
        name,
        barcode,
        category,
        purchasePrice: Number(purchasePrice),
        sellingPrice: Number(sellingPrice),
        stock: Number(stock),
      },
    });

    if (product.stock <= LOW_STOCK_THRESHOLD) {
      await notifyLowStock(prisma, product);
    }

    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to add product",
    });
  }
};

// Update Product
const updateProduct = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const {
      name,
      barcode,
      category,
      purchasePrice,
      sellingPrice,
      stock,
    } = req.body;

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });
    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        barcode,
        category,
        purchasePrice: Number(purchasePrice),
        sellingPrice: Number(sellingPrice),
        stock: Number(stock),
      },
    });

    if (
      existingProduct &&
      existingProduct.stock > LOW_STOCK_THRESHOLD &&
      product.stock <= LOW_STOCK_THRESHOLD
    ) {
      await notifyLowStock(prisma, product);
    } else if (
      existingProduct &&
      existingProduct.stock <= LOW_STOCK_THRESHOLD &&
      product.stock > LOW_STOCK_THRESHOLD
    ) {
      await resolveLowStock(prisma, product.id);
    }

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to update product",
    });
  }
};

// Delete Product
const deleteProduct = async (req, res) => {
  try {
    const id = Number(req.params.id);

    await prisma.product.delete({
      where: { id },
    });
    await resolveLowStock(prisma, id);

    res.json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to delete product",
    });
  }
};

module.exports = {
  getProducts,
  getProductByBarcode,
  createGetProductByBarcodeHandler,
  getBarcodeCatalogProduct,
  createGetBarcodeCatalogHandler,
  addProduct,
  updateProduct,
  deleteProduct,
};