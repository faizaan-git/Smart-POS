import { lazy, Suspense, useEffect, useState } from "react";

import Layout from "./components/Layout";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Products = lazy(() => import("./pages/Products"));
const Billing = lazy(() => import("./pages/Billing"));
const Sales = lazy(() => import("./pages/Sales"));
const Reports = lazy(() => import("./pages/Reports"));
const Customers = lazy(() => import("./pages/Customers"));
const Settings = lazy(() => import("./pages/Settings"));
const Cashiers = lazy(() => import("./pages/Cashiers"));
const Managers = lazy(() => import("./pages/Managers"));
const CashierSettings = lazy(() => import("./pages/CashierSettings"));
const UPIPaymentSettings = lazy(() => import("./pages/UPIPaymentSettings"));
const Login = lazy(() => import("./pages/Login"));
import api from "./services/api";
import { getThemePreference, saveThemePreference } from "./services/themePreferences";

const notifySessionClosed = (token) =>
  fetch("/api/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    keepalive: true,
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Session close notification failed with status ${response.status}`);
    }
  });

const pagesByRole = {
  ADMIN: ["dashboard", "billing", "products", "sales", "reports", "customers", "cashiers", "managers", "upi-history", "settings"],
  MANAGER: ["dashboard", "billing", "products", "sales", "reports", "customers"],
  CASHIER: ["billing", "cashier-settings"],
};

const getPageStorageKey = (user) => `smartpos-current-page-${user?.id || user?.role || "guest"}`;

const getInitialPage = (user) => {
  const allowedPages = pagesByRole[user?.role] || pagesByRole.ADMIN;
  const savedPage = sessionStorage.getItem(getPageStorageKey(user));
  if (allowedPages.includes(savedPage)) return savedPage;
  return user?.role === "CASHIER" ? "billing" : "dashboard";
};

function App() {
  const currentUser = JSON.parse(sessionStorage.getItem("user") || "null");
  const isCashier = currentUser?.role === "CASHIER";
  const isManager = currentUser?.role === "MANAGER";

  const [isLoggedIn, setIsLoggedIn] = useState(
    !!sessionStorage.getItem("token")
  );
  const [blockedByAdmin, setBlockedByAdmin] = useState(false);

  const [page, setPage] = useState(() => getInitialPage(currentUser));
  const changePage = (nextPage) => {
    const allowedPages = pagesByRole[currentUser?.role] || pagesByRole.ADMIN;
    if (!allowedPages.includes(nextPage)) return;
    sessionStorage.setItem(getPageStorageKey(currentUser), nextPage);
    setPage(nextPage);
  };

  useEffect(() => {
    if (!isLoggedIn || (!isCashier && !isManager)) {
      return undefined;
    }

    let sessionClosing = false;
    let interval;

    const checkSession = async () => {
      if (sessionClosing) return;

      try {
        await api.get("/auth/session");
      } catch (error) {
        if (error.response?.data?.code === "ACCOUNT_BLOCKED") {
          setBlockedByAdmin(true);
        }
      }
    };

    const handlePageHide = () => {
      sessionClosing = true;
      clearInterval(interval);

      const token = sessionStorage.getItem("token");
      if (token) {
        void notifySessionClosed(token).catch((error) => {
          console.error(error);
        });
      }
    };

    checkSession();
    interval = setInterval(checkSession, 3000);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      clearInterval(interval);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [isLoggedIn, isCashier, isManager]);

  // =====================================================
  // GLOBAL THEME
  // =====================================================

  const [theme, setTheme] = useState(
    () => getThemePreference(currentUser)
  );

  useEffect(() => {
    const root = document.documentElement;

    let activeTheme = theme;

    if (theme === "system") {
      activeTheme = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches
        ? "dark"
        : "light";
    }

    root.setAttribute("data-theme", activeTheme);
  }, [theme]);

  useEffect(() => {
    if (isLoggedIn) saveThemePreference(theme);
  }, [theme, isLoggedIn, currentUser?.id]);

  // Listen for theme changes made from Settings
  useEffect(() => {
    const handleThemeChange = () => {
      setTheme(getThemePreference());
    };

    window.addEventListener(
      "smartpos-theme-change",
      handleThemeChange
    );

    return () => {
      window.removeEventListener(
        "smartpos-theme-change",
        handleThemeChange
      );
    };
  }, []);

  useEffect(() => {
    const handleCashierThemeChange = (event) => {
      if (isCashier) {
        setTheme(event.detail === "dark" ? "dark" : "light");
      }
    };

    window.addEventListener("cashier-theme-change", handleCashierThemeChange);

    return () => {
      window.removeEventListener("cashier-theme-change", handleCashierThemeChange);
    };
  }, [isCashier]);

  // =====================================================
  // LOGIN
  // =====================================================

  const handleLogin = () => {
    const user = JSON.parse(sessionStorage.getItem("user") || "null");
    const nextPage = user?.role === "CASHIER" ? "billing" : "dashboard";

    setTheme(
      getThemePreference(user)
    );
    setIsLoggedIn(true);
    sessionStorage.setItem(getPageStorageKey(user), nextPage);
    setPage(nextPage);
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = async () => {
    const token = sessionStorage.getItem("token");
    saveThemePreference(theme);

    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
      } catch (error) {
        console.error("Logout failed:", error);
      }
    }

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem(getPageStorageKey(currentUser));

    setIsLoggedIn(false);
    setBlockedByAdmin(false);
    setTheme(getThemePreference(null));
    setPage("dashboard");
  };

  if (blockedByAdmin) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", background: "#f8fafc" }}>
        <div style={{ maxWidth: "480px", padding: "32px", textAlign: "center", background: "#fff", border: "1px solid #fecaca", borderRadius: "12px" }}>
          <h1 style={{ color: "#b91c1c" }}>Access blocked</h1>
          <p>Your account has been blocked by the administrator. Access is disabled until the account is unblocked.</p>
          <button onClick={handleLogout}>Return to login</button>
        </div>
      </div>
    );
  }

  // =====================================================
  // AUTH SCREENS
  // =====================================================

  if (!isLoggedIn) {
    return (
      <Suspense fallback={<div role="status">Loading SmartPOS...</div>}>
        <Login onLogin={handleLogin} />
      </Suspense>
    );
  }

  // =====================================================
  // PAGE SWITCHING
  // =====================================================

  const renderPage = () => {
    if (isCashier) {
      if (page === "cashier-settings") {
        return <CashierSettings onBack={() => changePage("billing")} />;
      }

      return (
        <Billing
          isCashier
          onOpenSettings={() => changePage("cashier-settings")}
        />
      );
    }

    if (isManager) {
      switch (page) {
        case "billing":
          return <Billing />;
        case "products":
          return <Products />;
        case "sales":
          return <Sales />;
        case "customers":
          return <Customers />;
        case "reports":
          return <Reports />;
        case "dashboard":
        default:
          return <Dashboard />;
      }
    }

    switch (page) {
      case "dashboard":
        return <Dashboard />;

      case "products":
        return <Products />;

      case "billing":
        return <Billing />;

      case "sales":
        return <Sales />;

      case "customers":
        return <Customers />;

      case "reports":
        return <Reports />;

      case "cashiers":
        return <Cashiers />;

      case "managers":
        return <Managers />;

      case "settings":
        return <Settings />;

      case "upi-history":
        return <UPIPaymentSettings historyOnly />;

      default:
        return <Dashboard />;
    }
  };

  // =====================================================
  // MAIN APP
  // =====================================================

  return (
    <Layout
      page={page}
      setPage={changePage}
      onLogout={handleLogout}
      isCashier={isCashier}
      isManager={isManager}
    >
      <Suspense fallback={<div role="status">Loading page...</div>}>
        {renderPage()}
      </Suspense>
    </Layout>
  );
}

export default App;