const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/authMiddleware");
const {
  getPaymentSettings,
  updatePaymentSettings,
} = require("../controllers/paymentController");

const router = express.Router();
router.use(authenticateToken, requireRole("ADMIN"));
router.get("/payment-settings", getPaymentSettings);
router.put("/payment-settings", updatePaymentSettings);

module.exports = router;
