const prisma = require("../prisma/client");

// =====================================================
// GET BUSINESS SETTINGS
// =====================================================

const getBusinessSettings = async (req, res) => {
  try {
    let settings = await prisma.businessSettings.findFirst();

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.businessSettings.create({
        data: {},
      });
    }

    res.json(settings);
  } catch (error) {
    console.error("Get Business Settings Error:", error);

    res.status(500).json({
      message: "Failed to load business settings",
    });
  }
};


// =====================================================
// UPDATE BUSINESS SETTINGS
// =====================================================

const updateBusinessSettings = async (req, res) => {
  try {
    const {
      businessName,
      ownerName,
      phone,
      email,
      address,
      gstNumber,
    } = req.body;

    let settings = await prisma.businessSettings.findFirst();

    if (!settings) {
      settings = await prisma.businessSettings.create({
        data: {
          businessName,
          ownerName,
          phone,
          email,
          address,
          gstNumber,
        },
      });
    } else {
      settings = await prisma.businessSettings.update({
        where: {
          id: settings.id,
        },
        data: {
          businessName,
          ownerName,
          phone,
          email,
          address,
          gstNumber,
        },
      });
    }

    res.json({
      message: "Business settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("Update Business Settings Error:", error);

    res.status(500).json({
      message: "Failed to update business settings",
    });
  }
};


module.exports = {
  getBusinessSettings,
  updateBusinessSettings,
};