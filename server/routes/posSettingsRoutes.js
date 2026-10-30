const express = require("express");

const {
  getPOSSettings,
  updatePOSSettings,
} = require("../controllers/posSettingsController");

const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/authMiddleware");

router.use(authenticateToken);

router.get("/", requireRole("ADMIN", "CASHIER", "MANAGER"), getPOSSettings);

router.put("/", requireRole("ADMIN"), updatePOSSettings);

module.exports = router;