import { useState } from "react";
import { FaBell, FaUserCircle } from "react-icons/fa";
import AppIcon from "./AppIcon";

function Navbar({ onLogout }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      style={{
        height: "70px",
        background: "#ffffff",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 25px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
      }}
    >
      {/* Left Side */}
      <div>
        <h2 style={{ margin: 0 }}>Dashboard</h2>

        <p
          style={{
            margin: 0,
            color: "#666",
            fontSize: "14px",
          }}
        >
          Welcome to SmartPOS
        </p>
      </div>

      {/* Right Side */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          fontSize: "22px",
        }}
      >
        {/* Notification */}
        <FaBell
          style={{
            cursor: "pointer",
          }}
        />

        {/* User */}
        <div
          style={{
            position: "relative",
          }}
        >
          <FaUserCircle
            onClick={() => setShowMenu(!showMenu)}
            style={{
              cursor: "pointer",
              fontSize: "34px",
            }}
          />

          {/* Dropdown */}
          {showMenu && (
            <div
              style={{
                position: "absolute",
                top: "45px",
                right: 0,
                width: "160px",
                background: "#ffffff",
                borderRadius: "8px",
                boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
                padding: "8px 0",
                zIndex: 1000,
              }}
            >
              <button
                onClick={() => {
                  setShowMenu(false);
                  onLogout();
                }}
                style={{
                  width: "100%",
                  padding: "10px 15px",
                  border: "none",
                  background: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "14px",
                  color: "#dc2626",
                }}
              >
                <><AppIcon name="logout" /> Logout</>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Navbar;