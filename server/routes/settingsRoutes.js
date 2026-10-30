const express = require("express");

const {
  getBusinessSettings,
  updateBusinessSettings,
} = require("../controllers/settingsController");

const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/authMiddleware");

router.use(authenticateToken);


// GET business settings
router.get(
	"/business",
	requireRole("ADMIN", "CASHIER", "MANAGER"),
	getBusinessSettings
);


// UPDATE business settings
router.put("/business", requireRole("ADMIN"), updateBusinessSettings);


module.exports = router;