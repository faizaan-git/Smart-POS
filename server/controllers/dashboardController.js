const prisma = require("../prisma/client");
const { getOnlineCutoff } = require("../services/presence");

// ===============================
// Get Last 7 Days
// ===============================
const getLast7Days = () => {
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();

    date.setDate(date.getDate() - i);

    date.setHours(0, 0, 0, 0);

    days.push(date);
  }

  return days;
};

// ===============================
// Dashboard Statistics
// ===============================
exports.getDashboardStats = async (req, res) => {
  try {
    // Today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const onlineSince = getOnlineCutoff();

    const [
      totalProducts,
      totalCustomers,
      lowStock,
      cashierCount,
      onlineCashiers,
      managerCount,
      onlineManagers,
      totalSales,
      revenue,
      todaySales,
      recentSales,
      paymentStats,
    ] = await Promise.all([

      // Total Products
      prisma.product.count(),

      // Total Customers
      prisma.customer.count(),

      // Low Stock Products
      prisma.product.count({
        where: {
          stock: {
            lte: 10,
          },
        },
      }),

      prisma.user.count({ where: { role: "CASHIER", merchantId: req.user.merchantId } }),
      prisma.user.count({
        where: {
          role: "CASHIER",
          merchantId: req.user.merchantId,
          isOnline: true,
          isBlocked: false,
          lastSeenAt: { gte: onlineSince },
        },
      }),
      prisma.user.count({ where: { role: "MANAGER", merchantId: req.user.merchantId } }),
      prisma.user.count({
        where: {
          role: "MANAGER",
          merchantId: req.user.merchantId,
          isOnline: true,
          isBlocked: false,
          lastSeenAt: { gte: onlineSince },
        },
      }),

      // Total Sales
      prisma.sale.count({ where: { merchantId: req.user.merchantId, paymentStatus: "PAID" } }),

      // Total Revenue
      prisma.sale.aggregate({
        where: { merchantId: req.user.merchantId, paymentStatus: "PAID" },
        _sum: {
          total: true,
        },
      }),

      // Today's Sales
      prisma.sale.findMany({
        where: {
          merchantId: req.user.merchantId,
          paymentStatus: "PAID",
          createdAt: {
            gte: today,
          },
        },
      }),

      // Recent Sales
      prisma.sale.findMany({
        where: { merchantId: req.user.merchantId, paymentStatus: "PAID" },
        take: 5,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          customer: true,
        },
      }),

      // Payment Method Statistics
      prisma.sale.groupBy({
        where: { merchantId: req.user.merchantId, paymentStatus: "PAID" },
        by: ["paymentMethod"],
        _count: {
          paymentMethod: true,
        },
      }),

    ]);

    // Today's Revenue
    const todayRevenue = todaySales.reduce(
      (sum, sale) => sum + sale.total,
      0
    );

    // ===============================
    // Last 7 Days Revenue
    // ===============================
    const last7Days = getLast7Days();

    const salesChart = [];

    for (const day of last7Days) {
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);

      const sales = await prisma.sale.findMany({
        where: {
          merchantId: req.user.merchantId,
          paymentStatus: "PAID",
          createdAt: {
            gte: day,
            lt: nextDay,
          },
        },
      });

      const dayRevenue = sales.reduce(
        (sum, sale) => sum + sale.total,
        0
      );

      salesChart.push({
        day: day.toLocaleDateString("en-US", {
          weekday: "short",
        }),
        revenue: dayRevenue,
      });
    }

    // ===============================
    // Response
    // ===============================
    res.json({
      totalProducts,
      totalCustomers,
      lowStock,
      cashierCount,
      onlineCashiers,
      managerCount,
      onlineManagers,
      totalSales,

      totalRevenue: revenue._sum.total || 0,

      todaySales: todaySales.length,

      todayRevenue,

      recentSales,

      salesChart,

      paymentStats,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Dashboard Error",
    });
  }
};