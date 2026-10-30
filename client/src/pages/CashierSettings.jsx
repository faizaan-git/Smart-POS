import { useState } from "react";
import { toast } from "react-toastify";
import PageTitle from "../components/PageTitle";
import AppIcon from "../components/AppIcon";
import "./styles/CashierSettings.css";
import {
  getCashierPreferences,
  saveCashierPreferences,
} from "../services/cashierPreferences";

function CashierSettings({ onBack }) {
  const [preferences, setPreferences] = useState(getCashierPreferences);

  const savePreferences = () => {
    if (!saveCashierPreferences(preferences)) {
      toast.error("Cashier session not found. Please sign in again.");
      return;
    }

    toast.success("Cashier preferences saved.");
  };

  return (
    <div className="cashier-settings-page" style={{ maxWidth: "760px", padding: "8px 4px" }}>
      <button
        type="button"
        className="cashier-back-button"
        onClick={onBack}
        style={{ marginBottom: "18px", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", color: "#334155", cursor: "pointer" }}
      >
        Back to Billing
      </button>
      <PageTitle icon={<AppIcon name="settings" />}>Cashier Settings</PageTitle>
      <p style={{ color: "#64748b", marginBottom: "28px" }}>
        Preferences are saved for your cashier account on this device.
      </p>

      <section style={{ display: "grid", gap: "24px", borderTop: "1px solid #dbe2ea", borderBottom: "1px solid #dbe2ea", padding: "24px 0" }}>
        <label style={{ display: "grid", gap: "8px", maxWidth: "360px", fontWeight: 600 }}>
          Default payment method
          <select
            value={preferences.defaultPaymentMethod}
            onChange={(event) => setPreferences((current) => ({
              ...current,
              defaultPaymentMethod: event.target.value,
            }))}
            style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff" }}
          >
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="UPI">UPI</option>
          </select>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={preferences.confirmSale}
            onChange={(event) => setPreferences((current) => ({
              ...current,
              confirmSale: event.target.checked,
            }))}
          />
          Ask for confirmation before completing a sale
        </label>
      </section>

      <button
        type="button"
        onClick={savePreferences}
        style={{ marginTop: "20px", padding: "10px 16px", border: 0, borderRadius: "6px", background: "#2563eb", color: "#fff", cursor: "pointer" }}
      >
        Save preferences
      </button>
    </div>
  );
}

export default CashierSettings;