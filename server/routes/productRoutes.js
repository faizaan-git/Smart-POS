const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/authMiddleware");

const {
  getProducts,
  getProductByBarcode,
  getBarcodeCatalogProduct,
  addProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");

router.get("/", authenticateToken, getProducts);
router.get("/catalog/:barcode", authenticateToken, requireRole("ADMIN", "MANAGER"), getBarcodeCatalogProduct);
router.get("/barcode/:barcode", authenticateToken, getProductByBarcode);
router.post("/", authenticateToken, requireRole("ADMIN", "MANAGER"), addProduct);
router.put("/:id", authenticateToken, requireRole("ADMIN", "MANAGER"), updateProduct);
router.delete("/:id", authenticateToken, requireRole("ADMIN", "MANAGER"), deleteProduct);

module.exports = router;