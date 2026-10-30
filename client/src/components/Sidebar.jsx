import AppIcon from "./AppIcon";

function Sidebar({ page, setPage, isCashier, isManager }) {
  const menuItems = isCashier
    ? [
        { key: "billing", icon: "cart", label: "Billing" },
        { key: "cashier-settings", icon: "settings", label: "Settings" },
      ]
    : isManager
    ? [
        { key: "dashboard", icon: "chart", label: "Dashboard" },
        { key: "billing", icon: "cart", label: "Billing" },
        { key: "products", icon: "box", label: "Products" },
        { key: "sales", icon: "invoice", label: "Sales" },
        { key: "reports", icon: "chartLine", label: "Reports" },
        { key: "customers", icon: "users", label: "Customers" },
      ]
    : [
        { key: "dashboard", icon: "chart", label: "Dashboard" },
        { key: "billing", icon: "cart", label: "Billing" },
        { key: "products", icon: "box", label: "Products" },
        { key: "sales", icon: "invoice", label: "Sales" },
        { key: "reports", icon: "chartLine", label: "Reports" },
        { key: "customers", icon: "users", label: "Customers" },
        { key: "cashiers", icon: "user", label: "Cashiers" },
        { key: "managers", icon: "manager", label: "Managers" },
        { key: "settings", icon: "settings", label: "Settings" },
      ];

  return (
    <div
      id="main-navigation"
      style={{
        width: "250px",
        background: "#1e293b",
        color: "#fff",
        padding: "20px",
        position: "fixed",
        left: 0,
        top: "70px",
        height: "calc(100vh - 70px)",
        boxSizing: "border-box",
        overflowY: "auto",
        overscrollBehaviorY: "contain",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {menuItems.map((item) => (
        <button
          key={item.key}
          onClick={() => setPage(item.key)}
          style={{
            width: "100%",
            padding: "14px",
            marginBottom: "12px",
            background:
              page === item.key ? "#2563eb" : "transparent",
            color: "white",
            border: "none",
            borderRadius: "8px",
            textAlign: "left",
            cursor: "pointer",
            fontSize: "16px",
            transition: "0.2s",
          }}
        >
          <><AppIcon name={item.icon} /> {item.label}</>
        </button>
      ))}
    </div>
  );
}

export default Sidebar;