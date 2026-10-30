import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../services/api";

import DashboardCard from "../components/DashboardCard";
import SalesChart from "../components/SalesChart";
import PageTitle from "../components/PageTitle";
import AppIcon from "../components/AppIcon";
import "./styles/Dashboard.css";

const formatRevenue = (amount) => (
  `₹${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0)}`
);

function Dashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalCustomers: 0,
    cashierCount: 0,
    onlineCashiers: 0,
    managerCount: 0,
    onlineManagers: 0,
    totalSales: 0,
    totalRevenue: 0,
    todaySales: 0,
    todayRevenue: 0,
    lowStock: 0,
    recentSales: [],
    paymentStats: [],
  });

  useEffect(() => {
    let active = true;

    const loadDashboard = async (notifyOnFailure = true) => {
      try {
        const response = await api.get("/dashboard");
        if (active) setStats(response.data);
      } catch (error) {
        console.error(error);
        if (active && notifyOnFailure) toast.error("Failed to load dashboard");
      }
    };

    void loadDashboard();
    const refreshInterval = setInterval(() => {
      void loadDashboard(false);
    }, 10_000);

    return () => {
      active = false;
      clearInterval(refreshInterval);
    };
  }, []);

  return (
    <div
      className="admin-dashboard-page"
      style={{
        padding: "30px",
        background: "#f5f7fb",
        minHeight: "100vh",
      }}
    >
      <PageTitle icon={<AppIcon name="chart" />}>Dashboard</PageTitle>

      <div className="dashboard-stats-grid">
        <DashboardCard
          title="Today's Revenue"
          value={formatRevenue(stats.todayRevenue)}
          color="linear-gradient(135deg,#22c55e,#16a34a)"
          icon={<AppIcon name="money" />}
        />

        <DashboardCard
          title="Today's Sales"
          value={stats.todaySales}
          color="linear-gradient(135deg,#3b82f6,#2563eb)"
          icon={<AppIcon name="cart" />}
        />

        <DashboardCard
          title="Total Revenue"
          value={formatRevenue(stats.totalRevenue)}
          color="linear-gradient(135deg,#9333ea,#7e22ce)"
          icon={<AppIcon name="money" />}
        />

        <DashboardCard
          title="Products"
          value={stats.totalProducts}
          color="linear-gradient(135deg,#0ea5e9,#0284c7)"
          icon={<AppIcon name="box" />}
        />

        <DashboardCard
          title="Customers"
          value={stats.totalCustomers}
          color="linear-gradient(135deg,#f59e0b,#d97706)"
          icon={<AppIcon name="users" />}
        />

        <DashboardCard
          title="Cashiers"
          value={stats.cashierCount}
          subtitle={`${stats.onlineCashiers} online`}
          color="linear-gradient(135deg,#14b8a6,#0f766e)"
          icon={<AppIcon name="receipt" />}
        />

        <DashboardCard
          title="Managers"
          value={stats.managerCount}
          subtitle={`${stats.onlineManagers} online`}
          color="linear-gradient(135deg,#f97316,#c2410c)"
          icon={<AppIcon name="manager" />}
        />

        <DashboardCard
          title="Low Stock"
          value={stats.lowStock}
          color="linear-gradient(135deg,#ef4444,#dc2626)"
          icon={<AppIcon name="warning" />}
        />
      </div>

      <div
        style={{
          marginTop: "35px",
        }}
      >
        <SalesChart data={stats.salesChart}  />
      </div>
      

      <div
        className="admin-dashboard-recent"
        style={{
          background: "#fff",
          marginTop: "35px",
          borderRadius: "16px",
          padding: "20px",
          boxShadow: "0 10px 30px rgba(0,0,0,.08)",
        }}
      >
        <h2
          style={{
            marginBottom: "20px",
          }}
        >
          <AppIcon name="clock" /> Recent Sales
        </h2>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th align="left">Invoice</th>
              <th align="left">Customer</th>
              <th align="left">Amount</th>
              <th align="left">Payment</th>
              <th align="left">Date</th>
            </tr>
          </thead>

          <tbody>
            {stats.recentSales.length === 0 ? (
              <tr>
                <td colSpan="5" align="center">
                  No Sales Found
                </td>
              </tr>
            ) : (
              stats.recentSales.map((sale) => (
                <tr key={sale.id}>
                  <td>#{sale.id}</td>

                  <td>
                    {sale.customer
                      ? sale.customer.name
                      : "Walk-in Customer"}
                  </td>

                  <td>₹{sale.total}</td>

                  <td>{sale.paymentMethod}</td>

                  <td>
                    {new Date(sale.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Dashboard;