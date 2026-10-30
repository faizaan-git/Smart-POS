const prisma = require("../prisma/client");

// GET POS Settings
const getPOSSettings = async (req, res) => {
  try {
    let settings = await prisma.pOSSettings.findFirst();

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.pOSSettings.create({
        data: {},
      });
    }

    res.json(settings);
  } catch (error) {
    console.error("Get POS Settings Error:", error);

    res.status(500).json({
      message: "Failed to load POS settings",
    });
  }
};

// UPDATE POS Settings
const updatePOSSettings = async (req, res) => {
  try {
    const {
      enableTax,
      defaultTaxRate,
      enableDiscount,
      defaultDiscount,
      invoicePrefix,
      startingInvoiceNo,
      currency,
      allowNegativeStock,
      requireCustomer,
    } = req.body;

    let settings = await prisma.pOSSettings.findFirst();

    if (!settings) {
      settings = await prisma.pOSSettings.create({
        data: {
          enableTax,
          defaultTaxRate,
          enableDiscount,
          defaultDiscount,
          invoicePrefix,
          startingInvoiceNo,
          currency,
          allowNegativeStock,
          requireCustomer,
        },
      });
    } else {
      settings = await prisma.pOSSettings.update({
        where: {
          id: settings.id,
        },
        data: {
          enableTax,
          defaultTaxRate,
          enableDiscount,
          defaultDiscount,
          invoicePrefix,
          startingInvoiceNo,
          currency,
          allowNegativeStock,
          requireCustomer,
        },
      });
    }

    res.json({
      message: "POS settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("Update POS Settings Error:", error);

    res.status(500).json({
      message: "Failed to update POS settings",
    });
  }
};

module.exports = {
  getPOSSettings,
  updatePOSSettings,
};