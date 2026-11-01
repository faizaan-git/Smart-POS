const express = require("express");
const cors = require("cors");
require("dotenv").config();

if (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET === "smartpossecret" ||
  process.env.JWT_SECRET.length < 32
) {
  throw new Error("JWT_SECRET must be configured with a unique value of at least 32 characters");
}

const app = express();

app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require("./routes/authRoutes");
const cashierRoutes = require("./routes/cashierRoutes");
const managerRoutes = require("./routes/managerRoutes");
const productRoutes = require("./routes/productRoutes");
const saleRoutes = require("./routes/saleRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const salesHistoryRoutes = require("./routes/salesHistoryRoutes");
const customerRoutes = require("./routes/customerRoutes");
const reportRoutes = require("./routes/reportRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const posSettingsRoutes = require("./routes/posSettingsRoutes");
const receiptSettingsRoutes = require("./routes/receiptSettingsRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const merchantRoutes = require("./routes/merchantRoutes");
app.use("/api/auth", authRoutes);
app.use("/api/cashiers", cashierRoutes);
app.use("/api/managers", managerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/sales-history", salesHistoryRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/pos-settings", posSettingsRoutes);
app.use("/api/receipt-settings", receiptSettingsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/merchant", merchantRoutes);
// Home Route
app.get("/", (req, res) => {
  res.json({
    message: "🚀 SmartPOS Backend Running Successfully"
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});