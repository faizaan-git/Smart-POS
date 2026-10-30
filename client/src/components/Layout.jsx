import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

function Layout({ page, setPage, children, onLogout, isCashier, isManager }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const showSidebar = !isCashier && sidebarOpen;

  return (
    <div style={{ display: "flex" }}>
      {showSidebar && (
        <Sidebar
          page={page}
          setPage={setPage}
          onLogout={onLogout}
          isCashier={isCashier}
          isManager={isManager}
        />
      )}

      <div
        className={isCashier ? "cashier-layout-main" : "admin-layout-main"}
        style={{
          marginLeft: showSidebar ? "250px" : 0,
          width: showSidebar ? "calc(100% - 250px)" : "100%",
          minWidth: 0,
          boxSizing: "border-box",
          minHeight: "100vh",
          background: "#f3f4f6",
        }}
      >
        <Topbar
          onLogout={onLogout}
          setPage={setPage}
          isCashier={isCashier}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={isCashier ? undefined : () => setSidebarOpen((open) => !open)}
        />

        <div className={`app-page-content${isCashier ? "" : " admin-app-page-content"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Layout;