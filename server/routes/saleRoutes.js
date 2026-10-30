const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");

const {
  createSale,
  getSales,
} = require("../controllers/saleController");

router.post("/", authenticateToken, createSale);
router.get("/", authenticateToken, getSales);

module.exports = router;