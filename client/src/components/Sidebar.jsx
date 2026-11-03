import AppIcon from "./AppIcon";
import "./Sidebar.css";

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
        { key: "returns", icon: "receipt", label: "Returns" },
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
        { key: "upi-history", icon: "creditCard", label: "UPI Payment History" },
        { key: "returns", icon: "receipt", label: "Returns" },
        { key: "settings", icon: "settings", label: "Settings" },
      ];

  return (
    <div
      id="main-navigation"
      className="app-sidebar"
      style={{
        width: "250px",
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
          className={`app-sidebar-item${page === item.key ? " is-active" : ""}`}
          onClick={() => setPage(item.key)}
        >
          <><AppIcon name={item.icon} /> {item.label}</>
        </button>
      ))}
    </div>
  );
}

export default Sidebar;