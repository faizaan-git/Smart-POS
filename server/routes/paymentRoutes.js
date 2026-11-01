const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/authMiddleware");
const { createUpiPayment } = require("../controllers/saleController");
const {
  getPayment,
  approvePayment,
  listPayments,
} = require("../controllers/paymentController");

const router = express.Router();
router.use(authenticateToken);

router.post("/upi/create", requireRole("ADMIN", "MANAGER", "CASHIER"), createUpiPayment);
router.get("/merchant/history", requireRole("ADMIN"), listPayments);
router.get("/:id", requireRole("ADMIN", "MANAGER", "CASHIER"), getPayment);
router.post("/:id/approve", requireRole("ADMIN", "MANAGER", "CASHIER"), approvePayment);

module.exports = router;
