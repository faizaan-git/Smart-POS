import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../services/api";
import PageTitle from "../components/PageTitle";
import "./styles/UPIPaymentSettings.css";

const EMPTY_SETTINGS = {
  businessName: "",
  upiId: "",
  upiDisplayName: "",
  accountHolderName: "",
  accountNumber: "",
  ifscCode: "",
  bankName: "",
  paymentInstructions: "",
  enabled: false,
  qrExpirationMinutes: 10,
};

const STATUS_OPTIONS = ["ALL", "PENDING", "SUCCESS", "FAILED", "EXPIRED"];

function UPIPaymentSettings({ embedded = false, historyOnly = false, showHistory = true }) {
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(historyOnly ? "ALL" : "PENDING");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const loadPayments = useCallback(async () => {
    if (!showHistory) return;
    const params = {};
    if (status !== "ALL") params.status = status;
    if (search.trim()) params.search = search.trim();
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const response = await api.get("/payments/merchant/history", { params });
    setPayments(response.data);
  }, [showHistory, status, search, startDate, endDate]);

  useEffect(() => {
    let active = true;
    Promise.all([
      historyOnly ? Promise.resolve(null) : api.get("/merchant/payment-settings"),
    ])
      .then(([settingsResponse]) => {
        if (!active) return;
        if (settingsResponse) {
          setSettings({ ...EMPTY_SETTINGS, ...settingsResponse.data });
        }
      })
      .catch((error) => {
        console.error("Could not load UPI payment settings:", error);
        toast.error(error.response?.data?.message || "Could not load UPI payment settings");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [historyOnly]);

  useEffect(() => {
    if (loading || !showHistory) return;
    loadPayments().catch((error) => {
      console.error("Could not filter UPI payment history:", error);
      toast.error(error.response?.data?.message || "Could not load payment history");
    });
  }, [loadPayments, loading, showHistory]);

  useEffect(() => {
    if (loading || !showHistory || historyOnly) return undefined;
    const interval = window.setInterval(() => {
      loadPayments().catch((error) => {
        console.error("Could not refresh UPI payment history:", error);
      });
    }, 4000);
    return () => window.clearInterval(interval);
  }, [loadPayments, loading, historyOnly, showHistory]);

  const saveSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await api.put("/merchant/payment-settings", settings);
      setSettings({ ...EMPTY_SETTINGS, ...response.data });
      toast.success("UPI payment settings saved");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save UPI settings");
    } finally {
      setSaving(false);
    }
  };

  const input = (label, key, props = {}) => (
    <label className="upi-setting-field" key={key}>
      <span>{label}</span>
      <input
        value={settings[key]}
        onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))}
        {...props}
      />
    </label>
  );

  return (
    <div className={`upi-settings-page${embedded ? " upi-settings-embedded" : ""}${historyOnly ? " upi-history-page" : ""}`}>
      {historyOnly && (
        <div className="upi-settings-title">
          <PageTitle title="UPI Payment History" />
          <p>View UPI transactions for your merchant. Payment confirmations are recorded at the cashier.</p>
        </div>
      )}
      {!embedded && !historyOnly && <PageTitle title="UPI Payment Settings" />}
      {embedded && (
        <div className="upi-settings-title">
          <h2>UPI Payment Settings</h2>
          <p>Configure your merchant payment details.</p>
        </div>
      )}
      {!historyOnly && <section className="upi-settings-card">
        <h2>Merchant payment configuration</h2>
        <p>These details are available only to administrators for your merchant account.</p>
        {loading ? <p>Loading payment settings…</p> : (
          <form onSubmit={saveSettings}>
            <div className="upi-settings-grid">
              {input("Business name", "businessName", { maxLength: 120, required: true })}
              {input("Merchant UPI ID", "upiId", { maxLength: 320, placeholder: "shop@bank", required: settings.enabled })}
              {input("UPI display name", "upiDisplayName", { maxLength: 100, required: settings.enabled })}
              {input("Bank account holder name", "accountHolderName", { maxLength: 120, required: settings.enabled })}
              {input("Bank account number", "accountNumber", { maxLength: 20, inputMode: "numeric", required: settings.enabled })}
              {input("IFSC code", "ifscCode", { maxLength: 11, required: settings.enabled })}
              {input("Bank name", "bankName", { maxLength: 120, required: settings.enabled })}
              <label className="upi-setting-field">
                <span>QR expiration (minutes)</span>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={settings.qrExpirationMinutes}
                  onChange={(event) => setSettings((current) => ({
                    ...current,
                    qrExpirationMinutes: Number(event.target.value),
                  }))}
                  required
                />
              </label>
              <label className="upi-setting-field upi-instructions-field">
                <span>Payment instructions</span>
                <textarea
                  value={settings.paymentInstructions}
                  maxLength={1000}
                  rows={3}
                  onChange={(event) => setSettings((current) => ({
                    ...current,
                    paymentInstructions: event.target.value,
                  }))}
                />
              </label>
            </div>
            <label className="upi-enabled-toggle">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))}
              />
              Enable UPI payments for this merchant
            </label>
            <button type="submit" className="upi-save-button" disabled={saving || loading}>
              {saving ? "Saving…" : "Save payment settings"}
            </button>
          </form>
        )}
      </section>}

      {showHistory && <section className="upi-settings-card">
        <div className="upi-history-heading">
          <div>
            <h2>UPI payment history</h2>
            <p>Payment approvals are recorded with the staff member and timestamp.</p>
          </div>
          <button type="button" onClick={() => loadPayments().catch((error) => toast.error(error.response?.data?.message || "Could not refresh payments"))}>
            Refresh
          </button>
        </div>
        <div className="upi-payment-filters">
          <label>
            Search bill / reference
            <input value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUS_OPTIONS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            From
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
        <div className="upi-payment-table-wrap">
          <table className="upi-payment-table">
            <thead>
              <tr><th>Bill</th><th>Amount</th><th>Status</th><th>Created</th><th>Approval</th></tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.sale.invoiceNumber || `#${payment.saleId}`}</td>
                  <td>₹{Number(payment.amount).toFixed(2)}</td>
                  <td><span className={`upi-status-badge status-${payment.status.toLowerCase()}`}>{payment.status}</span></td>
                  <td>{new Date(payment.createdAt).toLocaleString()}</td>
                  <td>
                    {payment.verifiedBy ? (
                      <span>{payment.verifier?.name || "Staff"}<br />{new Date(payment.verifiedAt).toLocaleString()}</span>
                    ) : "—"}
                    {payment.verificationLogs?.map((log) => (
                      <small className="upi-audit-line" key={log.id}>
                        {log.action === "SOUNDBOX_CONFIRMED"
                          ? `Soundbox confirmed by ${log.actor.name}`
                          : log.action === "APPROVED"
                            ? `Cashier approved: ${log.actor.name}`
                          : `${log.action.replace(/_/g, " ")} by ${log.actor.name}`}
                      </small>
                    ))}
                  </td>
                </tr>
              ))}
              {!payments.length && <tr><td colSpan="5">No UPI payments match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>}
    </div>
  );
}

export default UPIPaymentSettings;
