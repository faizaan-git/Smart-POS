const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/authMiddleware");

const {
  getDashboardStats,
} = require("../controllers/dashboardController");

router.get("/", authenticateToken, requireRole("ADMIN", "MANAGER"), getDashboardStats);

module.exports = router;