const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/authMiddleware");

const {
  getSalesHistory,
} = require("../controllers/salesHistoryController");


router.get("/", authenticateToken, requireRole("ADMIN", "MANAGER"), getSalesHistory);


module.exports = router;