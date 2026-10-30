const express = require("express");

const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");


const {
  addCustomer,
  getCustomers,
  searchCustomer
} = require("../controllers/customerController");



router.post("/", authenticateToken, addCustomer);

router.get("/", authenticateToken, getCustomers);

router.get("/search", authenticateToken, searchCustomer);



module.exports = router;