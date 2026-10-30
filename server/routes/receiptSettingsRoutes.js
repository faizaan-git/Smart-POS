const express = require("express");

const {
  getReceiptSettings,
  updateReceiptSettings,
} = require("../controllers/receiptSettingsController");

const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/authMiddleware");

router.use(authenticateToken);

router.get("/", requireRole("ADMIN", "CASHIER", "MANAGER"), getReceiptSettings);
router.put("/", requireRole("ADMIN"), updateReceiptSettings);

module.exports = router;