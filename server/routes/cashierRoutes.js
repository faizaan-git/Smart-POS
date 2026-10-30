const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/authMiddleware");

const {
  listEmployees,
  createEmployee,
  toggleEmployeeBlock,
  removeEmployee,
} = require("../controllers/cashierController");

router.use(authenticateToken, requireRole("ADMIN"));

router.get("/", listEmployees);
router.post("/", createEmployee);
router.patch("/:id/block", toggleEmployeeBlock);
router.delete("/:id", removeEmployee);

module.exports = router;
