const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/authMiddleware");

const {
  getSalesHistory,
} = require("../controllers/salesHistoryController");
const { createSaleReturn } = require("../controllers/saleReturnController");


router.get("/", authenticateToken, requireRole("ADMIN", "MANAGER"), getSalesHistory);
router.post("/:saleId/returns", authenticateToken, requireRole("ADMIN", "MANAGER"), createSaleReturn);


module.exports = router;