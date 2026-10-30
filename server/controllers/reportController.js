const prisma = require("../prisma/client");

// ==========================================
// SALES REPORT
// ==========================================
exports.getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // ------------------------------------------
    // Build date filter
    // ------------------------------------------
    const where = {};

    if (startDate || endDate) {
      where.createdAt = {};

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        where.createdAt.gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        where.createdAt.lte = end;
      }
    }

    // ------------------------------------------
    // Get sales
    // ------------------------------------------
    const sales = await prisma.sale.findMany({
      where,

      orderBy: {
        createdAt: "desc",
      },

      include: {
        customer: true,

        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // ------------------------------------------
    // Calculate summary
    // ------------------------------------------
    const totalSales = sales.length;

    const totalRevenue = sales.reduce(
      (sum, sale) => sum + Number(sale.total),
      0
    );

    // ------------------------------------------
    // Payment method summary
    // ------------------------------------------
    const paymentSummary = {};

    sales.forEach((sale) => {
      const method = sale.paymentMethod || "Cash";

      if (!paymentSummary[method]) {
        paymentSummary[method] = {
          count: 0,
          amount: 0,
        };
      }

      paymentSummary[method].count += 1;

      paymentSummary[method].amount += Number(
        sale.total
      );
    });

    // ------------------------------------------
    // Response
    // ------------------------------------------
    res.json({
      summary: {
        totalSales,
        totalRevenue,
      },

      paymentSummary,

      sales,
    });

  } catch (error) {
    console.error("Sales Report Error:", error);

    res.status(500).json({
      message: "Failed to generate sales report",
    });
  }
};