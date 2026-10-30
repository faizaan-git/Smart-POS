import AppIcon from "./AppIcon";

function Header() {
  return (
    <div
      style={{
        background: "#2563eb",
        color: "white",
        padding: "15px 25px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderRadius: "8px",
        marginBottom: "20px",
      }}
    >
      <h2 style={{ margin: 0 }}><AppIcon name="store" /> SmartPOS</h2>

      <div>
        <span style={{ marginRight: "20px" }}>
          Cashier: Admin
        </span>

        <button
          style={{
            padding: "8px 15px",
            background: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default Header;