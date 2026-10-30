import { useState } from "react";
import {
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaStore,
} from "react-icons/fa";
import { toast } from "react-toastify";
import api from "../services/api";
import PageTitle from "../components/PageTitle";
import AppIcon from "../components/AppIcon";
import "./styles/Login.css";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.warning(
        "Please enter your email and password."
      );
      return;
    }

    try {
      setLoading(true);

      const res = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });

      sessionStorage.setItem("token", res.data.token);

      if (res.data.user) {
        sessionStorage.setItem(
          "user",
          JSON.stringify(res.data.user)
        );
      }

      toast.success(
        "Welcome back! Login successful."
      );

      setTimeout(() => {
        onLogin();
      }, 700);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Login failed. Please try again.";

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-page"
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background:
          "linear-gradient(135deg, #eff6ff 0%, #f8fafc 50%, #e0e7ff 100%)",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "18px",
          padding: "40px",
          boxSizing: "border-box",
          boxShadow:
            "0 15px 45px rgba(15, 23, 42, 0.12)",
          border: "1px solid #e5e7eb",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              width: "65px",
              height: "65px",
              borderRadius: "16px",
              background:
                "linear-gradient(135deg, #2563eb, #1d4ed8)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              color: "#ffffff",
              fontSize: "28px",
              boxShadow:
                "0 8px 20px rgba(37, 99, 235, 0.25)",
            }}
          >
            <FaStore />
          </div>
        </div>

        {/* Heading */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "30px",
          }}
        >
          <PageTitle icon={<AppIcon name="store" />} className="page-title-centered page-title-auth">
            SmartPOS
          </PageTitle>

          <p
            style={{
              marginTop: "8px",
              marginBottom: 0,
              color: "#6b7280",
              fontSize: "14px",
            }}
          >
            Sign in to manage your business
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          {/* Email */}
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: "600",
              color: "#374151",
            }}
          >
            Email Address
          </label>

          <div
            style={{
              position: "relative",
              marginBottom: "20px",
            }}
          >
            <FaEnvelope
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#9ca3af",
                fontSize: "15px",
              }}
            />

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              autoComplete="email"
              style={{
                width: "100%",
                height: "48px",
                padding: "0 14px 0 42px",
                boxSizing: "border-box",
                border: "1px solid #d1d5db",
                borderRadius: "9px",
                outline: "none",
                fontSize: "14px",
                color: "#111827",
                background: "#ffffff",
              }}
            />
          </div>

          {/* Password */}
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: "600",
              color: "#374151",
            }}
          >
            Password
          </label>

          <div
            style={{
              position: "relative",
              marginBottom: "15px",
            }}
          >
            <FaLock
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#9ca3af",
                fontSize: "15px",
              }}
            />

            <input
              type={
                showPassword ? "text" : "password"
              }
              placeholder="Enter your password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              autoComplete="current-password"
              style={{
                width: "100%",
                height: "48px",
                padding: "0 45px 0 42px",
                boxSizing: "border-box",
                border: "1px solid #d1d5db",
                borderRadius: "9px",
                outline: "none",
                fontSize: "14px",
                color: "#111827",
                background: "#ffffff",
              }}
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(!showPassword)
              }
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                color: "#6b7280",
                cursor: "pointer",
                fontSize: "16px",
                padding: "5px",
              }}
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword ? (
                <FaEyeSlash />
              ) : (
                <FaEye />
              )}
            </button>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              height: "48px",
              border: "none",
              borderRadius: "9px",
              background:
                "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: "600",
              cursor: loading
                ? "not-allowed"
                : "pointer",
              opacity: loading ? 0.75 : 1,
              boxShadow:
                "0 6px 15px rgba(37, 99, 235, 0.25)",
              transition: "0.2s",
            }}
          >
            {loading
              ? "Signing in..."
              : "Sign In"}
          </button>
        </form>

        <div
          style={{
            textAlign: "center",
            marginTop: "22px",
            lineHeight: "1.5",
            fontSize: "14px",
            color: "#6b7280",
          }}
        >
          Need an account or password reset? Contact your SmartPOS administrator.
        </div>

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            marginTop: "22px",
            paddingTop: "20px",
            borderTop: "1px solid #f1f5f9",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "#9ca3af",
            }}
          >
            © {new Date().getFullYear()} SmartPOS
          </p>

          <p
            style={{
              margin: "5px 0 0",
              fontSize: "12px",
              color: "#9ca3af",
            }}
          >
            Point of Sale Management System
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;