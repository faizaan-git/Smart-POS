const prisma = require("../prisma/client");

// GET Receipt Settings
const getReceiptSettings = async (req, res) => {
  try {
    let settings = await prisma.receiptSettings.findFirst();

    if (!settings) {
      settings = await prisma.receiptSettings.create({
        data: {},
      });
    }

    res.json(settings);
  } catch (error) {
    console.error("Get Receipt Settings Error:", error);

    res.status(500).json({
      message: "Failed to load receipt settings",
    });
  }
};

// UPDATE Receipt Settings
const updateReceiptSettings = async (req, res) => {
  try {
    const {
      showBusinessName,
      showGSTNumber,
      showCustomerDetails,
      showCashierName,
      showTaxBreakdown,
      showDiscount,
      receiptSize,
      footerMessage,
    } = req.body;

    let settings = await prisma.receiptSettings.findFirst();

    if (!settings) {
      settings = await prisma.receiptSettings.create({
        data: {
          showBusinessName,
          showGSTNumber,
          showCustomerDetails,
          showCashierName,
          showTaxBreakdown,
          showDiscount,
          receiptSize,
          footerMessage,
        },
      });
    } else {
      settings = await prisma.receiptSettings.update({
        where: {
          id: settings.id,
        },
        data: {
          showBusinessName,
          showGSTNumber,
          showCustomerDetails,
          showCashierName,
          showTaxBreakdown,
          showDiscount,
          receiptSize,
          footerMessage,
        },
      });
    }

    res.json({
      message: "Receipt settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("Update Receipt Settings Error:", error);

    res.status(500).json({
      message: "Failed to update receipt settings",
    });
  }
};

module.exports = {
  getReceiptSettings,
  updateReceiptSettings,
};