const express = require("express");

const {
  getSalesReport,
} = require("../controllers/reportController");
const authenticateToken = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/sales", authenticateToken, requireRole("ADMIN", "MANAGER"), getSalesReport);

module.exports = router;