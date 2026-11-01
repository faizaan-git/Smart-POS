import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../services/api";
import PageTitle from "../components/PageTitle";
import AppIcon from "../components/AppIcon";
import "./styles/Cashiers.css";

export function EmployeeManagement({ role }) {
  const label = role === "MANAGER" ? "Manager" : "Cashier";
  const endpoint = role === "MANAGER" ? "/managers" : "/cashiers";
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const loadEmployees = async () => {
    try {
      const res = await api.get(endpoint);
      setEmployees(res.data || []);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to load ${label.toLowerCase()}s`);
    }
  };

  const refreshEmployees = async () => {
    setRefreshing(true);
    try {
      await loadEmployees();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const res = await api.get(endpoint);
        if (active) {
          setEmployees(res.data || []);
        }
      } catch (error) {
        console.error(error);
        toast.error(`Failed to load ${label.toLowerCase()}s`);
      }
    };

    void refresh();

    const interval = setInterval(() => {
      void refresh();
    }, 5000);

    const handleFocus = () => void refresh();
    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [endpoint, label]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const createEmployee = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.warning(`Please fill in all ${label.toLowerCase()} fields.`);
      return;
    }

    if (form.password.length < 6) {
      toast.warning("Password must be at least 6 characters long.");
      return;
    }

    try {
      setLoading(true);
      await api.post(endpoint, {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      toast.success(`${label} created successfully.`);
      setForm({ name: "", email: "", password: "" });
      loadEmployees();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || `Failed to create ${label.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleBlock = async (id) => {
    try {
      const res = await api.patch(`${endpoint}/${id}/block`);
      toast.success(res.data.message);
      loadEmployees();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || `Failed to update ${label.toLowerCase()} status`);
    }
  };

  const deleteEmployee = async (id) => {
    if (!window.confirm(`Remove this ${label.toLowerCase()} account?`)) {
      return;
    }

    try {
      const res = await api.delete(`${endpoint}/${id}`);
      toast.success(res.data.message);
      loadEmployees();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || `Failed to remove ${label.toLowerCase()}`);
    }
  };

  const filteredEmployees = employees.filter((employee) => {
    const search = searchTerm.trim().toLowerCase();
    const matchesSearch =
      employee.name.toLowerCase().includes(search) ||
      employee.email.toLowerCase().includes(search);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "blocked" && employee.isBlocked) ||
      (statusFilter === "online" && employee.isOnline && !employee.isBlocked) ||
      (statusFilter === "offline" && !employee.isOnline && !employee.isBlocked);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="admin-cashiers-page" style={{ padding: "30px" }}>
      <PageTitle icon={<AppIcon name={role === "MANAGER" ? "manager" : "user"} />}>
        {label} Management
      </PageTitle>

      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "12px",
          boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
          marginBottom: "25px",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Create {label}</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
          }}
        >
          <input
            type="text"
            name="name"
            placeholder={`${label} Name`}
            value={form.name}
            onChange={handleChange}
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
          />
        </div>

        <button
          onClick={createEmployee}
          disabled={loading}
          style={{
            marginTop: "15px",
            padding: "10px 20px",
            border: "none",
            borderRadius: "8px",
            background: "#2563eb",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Creating..." : `Create ${label}`}
        </button>
      </div>

      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "12px",
          boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
          <div>
            <h3 style={{ margin: 0 }}>{label} List</h3>
            <span style={{ color: "#6b7280", fontSize: "13px" }}>
              {filteredEmployees.length} of {employees.length} {label.toLowerCase()}s
            </span>
          </div>
          <button
            type="button"
            className="employee-list-refresh"
            onClick={refreshEmployees}
            disabled={refreshing}
            style={{ cursor: refreshing ? "wait" : "pointer" }}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          <input
            type="search"
            aria-label={`Search ${label.toLowerCase()}s`}
            placeholder="Search name or email"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <select
            aria-label={`Filter ${label.toLowerCase()}s by status`}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">Email</th>
              <th align="left">Status</th>
              <th align="left">Blocked</th>
              <th align="left">Last seen</th>
              <th align="left">Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan="6" align="center" style={{ padding: "24px", color: "#6b7280" }}>
                  {employees.length === 0 ? `No ${label.toLowerCase()}s found` : `No ${label.toLowerCase()}s match these filters`}
                </td>
              </tr>
            ) : (
              filteredEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.name}</td>
                  <td>{employee.email}</td>
                  <td>
                    <span
                      style={{
                        background: employee.isOnline ? "#dcfce7" : "#e5e7eb",
                        color: employee.isOnline ? "#166534" : "#374151",
                        padding: "5px 10px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      {employee.isOnline ? "Online" : "Offline"}
                    </span>
                  </td>
                  <td>{employee.isBlocked ? "Yes" : "No"}</td>
                  <td>{employee.lastSeenAt ? new Date(employee.lastSeenAt).toLocaleString() : "Never"}</td>
                  <td>
                    <button
                      onClick={() => toggleBlock(employee.id)}
                      style={{
                        marginRight: "8px",
                        padding: "6px 10px",
                        border: "none",
                        borderRadius: "6px",
                        background: employee.isBlocked ? "#22c55e" : "#f59e0b",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {employee.isBlocked ? "Unblock" : "Block"}
                    </button>

                    <button
                      onClick={() => deleteEmployee(employee.id)}
                      style={{
                        padding: "6px 10px",
                        border: "none",
                        borderRadius: "6px",
                        background: "#ef4444",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function Cashiers() {
  return <EmployeeManagement role="CASHIER" />;
}

export default Cashiers;
