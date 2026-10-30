import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaBell,
  FaBars,
} from "react-icons/fa";
import { toast } from "react-toastify";
import AppIcon from "./AppIcon";
import api from "../services/api";
import { subscribeToBusinessSettings } from "../services/businessSettingsEvents";
import { getThemePreference, saveThemePreference } from "../services/themePreferences";
import "./Topbar.css";

function Topbar({ onLogout, setPage, isCashier = false, sidebarOpen, onToggleSidebar }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState("");
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [loadingMoreNotifications, setLoadingMoreNotifications] = useState(false);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [businessName, setBusinessName] = useState("");
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || getThemePreference()
  );
  const notificationsRef = useRef(null);
  const currentUser = JSON.parse(sessionStorage.getItem("user") || "null");
  const role = currentUser?.role || "ADMIN";
  const canViewSales = role === "ADMIN" || role === "MANAGER";
  const roleDetails = {
    ADMIN: { label: "Admin", symbol: "A", className: "admin" },
    MANAGER: { label: "Manager", symbol: "M", className: "manager" },
    CASHIER: { label: "Cashier", symbol: "C", className: "cashier" },
  }[role] || { label: "User", symbol: "?", className: "admin" };

  const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || theme;
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    saveThemePreference(nextTheme);
    setTheme(nextTheme);
    window.dispatchEvent(new Event("smartpos-theme-change"));
    if (isCashier) {
      window.dispatchEvent(new CustomEvent("cashier-theme-change", {
        detail: nextTheme,
      }));
    }
  };

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = useCallback(async (all = false, skip = 0) => {
    const [notificationsResponse, unreadResponse] = await Promise.all([
      api.get(`/notifications?limit=${all ? 100 : 8}&skip=${skip}`),
      api.get("/notifications/unread-count"),
    ]);
    return {
      notifications: notificationsResponse.data || [],
      unreadCount: unreadResponse.data?.unreadCount || 0,
    };
  }, []);

  const loadNotifications = useCallback(async ({ all = false } = {}) => {
    setNotificationsLoading(true);
    try {
      const result = await fetchNotifications(all);
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      setHasMoreNotifications(all && result.notifications.length === 100);
      setNotificationError("");
    } catch (error) {
      console.error("Failed to load notifications:", error);
      setNotificationError(error.response?.data?.message || "Could not load notifications.");
    } finally {
      setNotificationsLoading(false);
    }
  }, [fetchNotifications]);

  const loadMoreNotifications = async () => {
    setLoadingMoreNotifications(true);
    try {
      const [notificationsResponse, unreadResponse] = await Promise.all([
        api.get(`/notifications?limit=100&skip=${notifications.length}`),
        api.get("/notifications/unread-count"),
      ]);
      const nextNotifications = notificationsResponse.data || [];
      setNotifications((current) => [...current, ...nextNotifications]);
      setUnreadCount(unreadResponse.data?.unreadCount || 0);
      setHasMoreNotifications(nextNotifications.length === 100);
      setNotificationError("");
    } catch (error) {
      console.error("Failed to load older notifications:", error);
      setNotificationError(error.response?.data?.message || "Could not load older notifications.");
    } finally {
      setLoadingMoreNotifications(false);
    }
  };

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await fetchNotifications(showAllNotifications);
        if (!active) return;
        setNotifications((current) => {
          if (!showAllNotifications || current.length <= 100) return result.notifications;
          const firstPageIds = new Set(result.notifications.map((item) => item.id));
          return [
            ...result.notifications,
            ...current.slice(100).filter((item) => !firstPageIds.has(item.id)),
          ];
        });
        setUnreadCount(result.unreadCount);
        setHasMoreNotifications((hasMore) => (
          showAllNotifications
            ? hasMore || result.notifications.length === 100
            : false
        ));
        setNotificationError("");
      } catch (error) {
        console.error("Failed to load notifications:", error);
        if (active) {
          setNotificationError(error.response?.data?.message || "Could not load notifications.");
        }
      } finally {
        if (active) setNotificationsLoading(false);
      }
    };

    void refresh();
    const interval = setInterval(() => void refresh(), 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [fetchNotifications, showAllNotifications]);

  useEffect(() => {
    if (!showNotifications) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!notificationsRef.current?.contains(event.target)) setShowNotifications(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setShowNotifications(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showNotifications]);

  useEffect(() => {
    let active = true;
    let receivedSettingsUpdate = false;
    const unsubscribe = subscribeToBusinessSettings((settings) => {
      receivedSettingsUpdate = true;
      setBusinessName(settings?.businessName?.trim() || "");
    });

    api.get("/settings/business")
      .then((response) => {
        if (active && !receivedSettingsUpdate) {
          setBusinessName(response.data?.businessName?.trim() || "");
        }
      })
      .catch((error) => {
        console.error("Failed to load business name:", error);
        if (active) toast.error("Failed to load business name.");
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const today = now.toLocaleDateString();
  const time = now.toLocaleTimeString();

  return (
    <div
      className={isCashier ? "cashier-topbar" : "admin-topbar"}
      style={{
        height: "70px",
        background: "#ffffff",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 25px",
        boxShadow: "0 2px 8px rgba(0,0,0,.08)",
        ...(isCashier ? {} : {
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          boxSizing: "border-box",
          zIndex: 1100,
        }),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {onToggleSidebar && (
          <button
            type="button"
            className="admin-nav-toggle"
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={sidebarOpen}
            aria-controls="main-navigation"
            title={sidebarOpen ? "Close navigation" : "Open navigation"}
            onClick={onToggleSidebar}
          >
            <FaBars size={16} />
          </button>
        )}
        <h2
        style={{
          color: "#2563eb",
          margin: 0,
        }}
        >
          <><AppIcon name="store" /> {businessName || "SmartPOS"}</>
        </h2>
      </div>

      {/* Right Side */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
        }}
      >
        {/* Date */}
        <span className={isCashier ? undefined : "admin-topbar-date"}>{today}</span>

        {/* Time */}
        <span className={isCashier ? undefined : "admin-topbar-time"}>{time}</span>

        <button
          type="button"
          className="topbar-theme-toggle"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          aria-pressed={theme === "dark"}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          onClick={toggleTheme}
        >
          <AppIcon name={theme === "dark" ? "sun" : "moon"} />
          <span className="topbar-theme-toggle-label">
            {theme === "dark" ? "Light" : "Dark"}
          </span>
        </button>

        {/* Notifications */}
        <div className="topbar-notifications" ref={notificationsRef}>
          <button
            type="button"
            className="topbar-notifications-trigger"
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
            aria-expanded={showNotifications}
            aria-controls="topbar-notifications-panel"
            title="Notifications"
            onClick={() => {
              const opening = !showNotifications;
              setShowNotifications(opening);
              if (opening) {
                setNotificationsLoading(true);
                void loadNotifications({ all: showAllNotifications });
              }
            }}
          >
            <FaBell size={20} />
            {unreadCount > 0 && (
              <span className="topbar-notifications-count">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <section
              id="topbar-notifications-panel"
              className="topbar-notifications-panel"
              aria-label="Notifications"
            >
              <header className="topbar-notifications-header">
                <strong>Notifications</strong>
                <div className="topbar-notifications-header-actions">
                  <span>{unreadCount} unread</span>
                  <button
                    type="button"
                    disabled={!unreadCount}
                    onClick={async () => {
                      try {
                        await api.patch("/notifications/read-all");
                        setNotifications((current) => current.map((item) => ({
                          ...item,
                          readAt: item.readAt || new Date().toISOString(),
                        })));
                        setUnreadCount(0);
                        setNotificationError("");
                      } catch (error) {
                        console.error("Failed to mark notifications as read:", error);
                        setNotificationError(error.response?.data?.message || "Could not update notifications.");
                      }
                    }}
                  >
                    Mark all read
                  </button>
                </div>
              </header>

              {notificationsLoading ? (
                <p className="topbar-notifications-empty" role="status">Loading notifications...</p>
              ) : notificationError ? (
                <div className="topbar-notifications-error" role="alert">
                  <p>{notificationError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setNotificationsLoading(true);
                      void loadNotifications({ all: showAllNotifications });
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : notifications.length === 0 ? (
                <p className="topbar-notifications-empty">You’re all caught up.</p>
              ) : (
                <ul className="topbar-notifications-list">
                  {notifications.map((notification) => (
                    <li key={notification.id}>
                      <button
                        type="button"
                        className={`topbar-notification-item${notification.readAt ? "" : " is-unread"}`}
                        onClick={async () => {
                          if (!notification.readAt) {
                            try {
                              await api.patch(`/notifications/${notification.id}/read`);
                              setNotifications((current) => current.map((item) => (
                                item.id === notification.id
                                  ? { ...item, readAt: new Date().toISOString() }
                                  : item
                              )));
                              setUnreadCount((count) => Math.max(0, count - 1));
                            } catch (error) {
                              console.error("Failed to mark notification as read:", error);
                              setNotificationError(error.response?.data?.message || "Could not update notification.");
                              return;
                            }
                          }
                          const page = notification.relatedType === "sale"
                            ? (canViewSales ? "sales" : "billing")
                            : notification.relatedType === "product"
                              ? (canViewSales ? "products" : "billing")
                              : notification.relatedType === "customer"
                                ? "customers"
                                : null;
                          if (page && setPage && (canViewSales || page === "products" || page === "billing")) {
                            setPage(page);
                          }
                          setShowNotifications(false);
                        }}
                      >
                        <span className="topbar-notification-icon" aria-hidden="true">
                          {notification.category === "LOW_STOCK"
                            ? "!"
                            : notification.category === "SALE"
                              ? <AppIcon name="receipt" />
                              : <AppIcon name="users" />}
                        </span>
                        <span className="topbar-notification-copy">
                          <strong>{notification.title}</strong>
                          <span>{notification.message}</span>
                          <small>{new Date(notification.createdAt).toLocaleString()}</small>
                          <small className={`topbar-notification-priority priority-${notification.priority.toLowerCase()}`}>
                            {notification.priority}
                          </small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {showAllNotifications && hasMoreNotifications && !notificationError && (
                <div className="topbar-notifications-load-more">
                  <button
                    type="button"
                    disabled={loadingMoreNotifications}
                    onClick={loadMoreNotifications}
                  >
                    {loadingMoreNotifications ? "Loading..." : "Load older notifications"}
                  </button>
                </div>
              )}
              {!notificationError && notifications.length > 0 && (
                <footer className="topbar-notifications-footer">
                  <button
                    type="button"
                    onClick={() => {
                      const showAll = !showAllNotifications;
                      setShowAllNotifications(showAll);
                      setNotificationsLoading(true);
                    }}
                  >
                    {showAllNotifications ? "Show recent notifications" : "View all notifications"}
                  </button>
                </footer>
              )}
            </section>
          )}
        </div>

        {/* User Menu */}
        <div
          style={{
            position: "relative",
          }}
        >
          <button
            type="button"
            className={`profile-role-button profile-role-${roleDetails.className}`}
            aria-label={`${roleDetails.label} profile`}
            aria-expanded={showMenu}
            title={`${roleDetails.label} profile`}
            onClick={() => setShowMenu(!showMenu)}
          >
            <span className="profile-role-badge profile-role-button-badge" aria-hidden="true">
              {roleDetails.symbol}
            </span>
          </button>

          {/* Dropdown */}
          {showMenu && (
            <div
              className={isCashier ? "cashier-user-menu" : "admin-user-menu"}
              style={{
                position: "absolute",
                top: "40px",
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
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onLogout();
                }}
                style={{
                  width: "100%",
                  padding: "10px 15px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  border: "none",
                  background: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "14px",
                  color: "#dc2626",
                }}
              >
                <AppIcon name="logout" style={{ display: "block", flexShrink: 0 }} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Topbar;