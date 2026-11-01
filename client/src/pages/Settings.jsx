import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../services/api";
import { publishBusinessSettingsUpdated } from "../services/businessSettingsEvents";
import PageTitle from "../components/PageTitle";
import AppIcon from "../components/AppIcon";
import UPIPaymentSettings from "./UPIPaymentSettings";
import "./styles/Settings.css";

function Settings() {
  // =====================================================
  // BUSINESS INFORMATION
  // =====================================================

  const [business, setBusiness] = useState({
    businessName: "",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
    gstNumber: "",
  });

  // =====================================================
  // POS SETTINGS
  // =====================================================

  const [posSettings, setPosSettings] = useState({
    enableTax: true,
    defaultTaxRate: 18,
    enableDiscount: true,
    defaultDiscount: 0,
    invoicePrefix: "INV-",
    startingInvoiceNo: 1001,
    currency: "INR",
    allowNegativeStock: false,
    requireCustomer: false,
  });

  // =====================================================
  // RECEIPT SETTINGS
  // =====================================================

  const [receiptSettings, setReceiptSettings] = useState({
    showBusinessName: true,
    showGSTNumber: true,
    showCustomerDetails: true,
    showCashierName: true,
    showTaxBreakdown: true,
    showDiscount: true,
    receiptSize: "80mm",
    footerMessage: "Thank you for shopping with us!",
  });

  // =====================================================
  // SECURITY
  // =====================================================

  const [security, setSecurity] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // =====================================================
  // LOADING / SAVING STATES
  // =====================================================

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPOS, setSavingPOS] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [exportingData, setExportingData] = useState(false);

  // =====================================================
  // LOAD SETTINGS
  // =====================================================

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);

        const [
          businessRes,
          posRes,
          receiptRes,
        ] = await Promise.all([
          api.get("/settings/business"),
          api.get("/pos-settings"),
          api.get("/receipt-settings"),
        ]);

        const businessData = businessRes.data || {};
        const posData = posRes.data || {};
        const receiptData = receiptRes.data || {};

        // Business
        setBusiness({
          businessName: businessData.businessName || "",
          ownerName: businessData.ownerName || "",
          phone: businessData.phone || "",
          email: businessData.email || "",
          address: businessData.address || "",
          gstNumber: businessData.gstNumber || "",
        });

        // POS
        setPosSettings({
          enableTax: posData.enableTax ?? true,
          defaultTaxRate: posData.defaultTaxRate ?? 18,
          enableDiscount: posData.enableDiscount ?? true,
          defaultDiscount: posData.defaultDiscount ?? 0,
          invoicePrefix: posData.invoicePrefix || "INV-",
          startingInvoiceNo:
            posData.startingInvoiceNo ?? 1001,
          currency: posData.currency || "INR",
          allowNegativeStock:
            posData.allowNegativeStock ?? false,
          requireCustomer:
            posData.requireCustomer ?? false,
        });

        // Receipt
        setReceiptSettings({
          showBusinessName:
            receiptData.showBusinessName ?? true,
          showGSTNumber:
            receiptData.showGSTNumber ?? true,
          showCustomerDetails:
            receiptData.showCustomerDetails ?? true,
          showCashierName:
            receiptData.showCashierName ?? true,
          showTaxBreakdown:
            receiptData.showTaxBreakdown ?? true,
          showDiscount:
            receiptData.showDiscount ?? true,
          receiptSize:
            receiptData.receiptSize || "80mm",
          footerMessage:
            receiptData.footerMessage ||
            "Thank you for shopping with us!",
        });
      } catch (error) {
        console.error(
          "Load Settings Error:",
          error
        );

        toast.error(
          error.response?.data?.message ||
            "Failed to load settings"
        );
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // =====================================================
  // BUSINESS CHANGE
  // =====================================================

  const handleBusinessChange = (e) => {
    const { name, value } = e.target;

    setBusiness((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =====================================================
  // POS CHANGE
  // =====================================================

  const handlePOSChange = (e) => {
    const {
      name,
      value,
      type,
      checked,
    } = e.target;

    setPosSettings((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : type === "number"
          ? Number(value)
          : value,
    }));
  };

  // =====================================================
  // RECEIPT CHANGE
  // =====================================================

  const handleReceiptChange = (e) => {
    const {
      name,
      value,
      type,
      checked,
    } = e.target;

    setReceiptSettings((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };

  // =====================================================
  // SECURITY CHANGE
  // =====================================================

  const handleSecurityChange = (e) => {
    const { name, value } = e.target;

    setSecurity((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =====================================================
  // SAVE BUSINESS
  // =====================================================

  const handleSaveBusiness = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);

      const response = await api.put(
        "/settings/business",
        business
      );

      if (response.data?.settings) {
        const data = response.data.settings;
        publishBusinessSettingsUpdated(data);

        setBusiness({
          businessName:
            data.businessName || "",
          ownerName:
            data.ownerName || "",
          phone:
            data.phone || "",
          email:
            data.email || "",
          address:
            data.address || "",
          gstNumber:
            data.gstNumber || "",
        });
      }

      toast.success(
        "Business information saved successfully"
      );
    } catch (error) {
      console.error(
        "Save Business Settings Error:",
        error
      );

      toast.error(
        error.response?.data?.message ||
          "Failed to save business information"
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // SAVE POS
  // =====================================================

  const handleSavePOS = async (e) => {
    e.preventDefault();

    try {
      setSavingPOS(true);

      const response = await api.put(
        "/pos-settings",
        posSettings
      );

      if (response.data?.settings) {
        const data = response.data.settings;

        setPosSettings({
          enableTax:
            data.enableTax ?? true,
          defaultTaxRate:
            data.defaultTaxRate ?? 18,
          enableDiscount:
            data.enableDiscount ?? true,
          defaultDiscount:
            data.defaultDiscount ?? 0,
          invoicePrefix:
            data.invoicePrefix || "INV-",
          startingInvoiceNo:
            data.startingInvoiceNo ?? 1001,
          currency:
            data.currency || "INR",
          allowNegativeStock:
            data.allowNegativeStock ?? false,
          requireCustomer:
            data.requireCustomer ?? false,
        });
      }

      toast.success(
        "POS settings saved successfully"
      );
    } catch (error) {
      console.error(
        "Save POS Settings Error:",
        error
      );

      toast.error(
        error.response?.data?.message ||
          "Failed to save POS settings"
      );
    } finally {
      setSavingPOS(false);
    }
  };

  // =====================================================
  // SAVE RECEIPT
  // =====================================================

  const handleSaveReceipt = async (e) => {
    e.preventDefault();

    try {
      setSavingReceipt(true);

      const response = await api.put(
        "/receipt-settings",
        receiptSettings
      );

      if (response.data?.settings) {
        const data = response.data.settings;

        setReceiptSettings({
          showBusinessName:
            data.showBusinessName ?? true,
          showGSTNumber:
            data.showGSTNumber ?? true,
          showCustomerDetails:
            data.showCustomerDetails ?? true,
          showCashierName:
            data.showCashierName ?? true,
          showTaxBreakdown:
            data.showTaxBreakdown ?? true,
          showDiscount:
            data.showDiscount ?? true,
          receiptSize:
            data.receiptSize || "80mm",
          footerMessage:
            data.footerMessage ||
            "Thank you for shopping with us!",
        });
      }

      toast.success(
        "Receipt settings saved successfully"
      );
    } catch (error) {
      console.error(
        "Save Receipt Settings Error:",
        error
      );

      toast.error(
        error.response?.data?.message ||
          "Failed to save receipt settings"
      );
    } finally {
      setSavingReceipt(false);
    }
  };

  // =====================================================
  // CHANGE PASSWORD
  // =====================================================

  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();

    const currentPassword =
      security.currentPassword.trim();

    const newPassword =
      security.newPassword.trim();

    const confirmPassword =
      security.confirmPassword.trim();

    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      toast.error(
        "Please fill in all password fields"
      );
      return;
    }

    if (newPassword.length < 6) {
      toast.error(
        "New password must be at least 6 characters"
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(
        "New passwords do not match"
      );
      return;
    }

    try {
      setChangingPassword(true);

      const response = await api.put(
        "/auth/change-password",
        {
          currentPassword,
          newPassword,
        }
      );

      toast.success(
        response.data?.message ||
          "Password changed successfully"
      );

      setSecurity({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error(
        "Change Password Error:",
        error
      );

      toast.error(
        error.response?.data?.message ||
          "Failed to change password"
      );
    } finally {
      setChangingPassword(false);
    }
  };

  // =====================================================
  // EXPORT DATA
  // =====================================================

  const handleExportData = async () => {
    try {
      setExportingData(true);

      const [
        productsResponse,
        customersResponse,
        salesResponse,
        cashiersResponse,
        managersResponse,
        businessResponse,
        posSettingsResponse,
        receiptSettingsResponse,
      ] = await Promise.all([
        api.get("/products"),
        api.get("/customers"),
        api.get("/sales-history"),
        api.get("/cashiers"),
        api.get("/managers"),
        api.get("/settings/business"),
        api.get("/pos-settings"),
        api.get("/receipt-settings"),
      ]);

      const exportedAt = new Date();
      const exportData = {
        format: "SmartPOS backup",
        version: 1,
        exportedAt: exportedAt.toISOString(),
        data: {
          products: productsResponse.data,
          customers: customersResponse.data,
          sales: salesResponse.data,
          cashiers: cashiersResponse.data,
          managers: managersResponse.data,
          businessSettings: businessResponse.data,
          posSettings: posSettingsResponse.data,
          receiptSettings: receiptSettingsResponse.data,
        },
      };

      const file = new Blob(
        [JSON.stringify(exportData, null, 2)],
        { type: "application/json;charset=utf-8" }
      );
      const downloadUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `smartpos-backup-${exportedAt.toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

      toast.success("POS data exported successfully");
    } catch (error) {
      console.error("Data export failed:", error);
      toast.error(error.response?.data?.message || "Failed to export POS data");
    } finally {
      setExportingData(false);
    }
  };

  // =====================================================
  // LOADING SCREEN
  // =====================================================

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-header">
          <div>
            <PageTitle icon={<AppIcon name="settings" />}>Settings</PageTitle>

            <p>
              Manage your SmartPOS preferences
              and business information
            </p>
          </div>
        </div>

        <section className="settings-card">
          <div className="settings-loading">
            <div className="settings-loading-icon">
              ⏳
            </div>

            <p>
              Loading settings...
            </p>
          </div>
        </section>
      </div>
    );
  }

  // =====================================================
  // MAIN UI
  // =====================================================

  return (
    <div className="settings-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="settings-header">
        <div>
          <PageTitle icon={<AppIcon name="settings" />}>Settings</PageTitle>

          <p>
            Manage your SmartPOS preferences
            and business information
          </p>
        </div>
      </div>

      {/* =================================================
          BUSINESS INFORMATION
      ================================================= */}

      <section className="settings-card">

        <div className="settings-card-header">

            <div className="settings-icon"><AppIcon name="building" /></div>

          <div>
            <h2>
              Business Information
            </h2>

            <p>
              Manage your business details
              used throughout SmartPOS
            </p>
          </div>

        </div>

        <form
          onSubmit={handleSaveBusiness}
        >

          <div className="settings-form-grid">

            <div className="settings-field">
              <label htmlFor="businessName">
                Business Name
              </label>

              <input
                id="businessName"
                name="businessName"
                type="text"
                placeholder="Enter business name"
                value={business.businessName}
                onChange={
                  handleBusinessChange
                }
              />
            </div>

            <div className="settings-field">
              <label htmlFor="ownerName">
                Owner Name
              </label>

              <input
                id="ownerName"
                name="ownerName"
                type="text"
                placeholder="Enter owner name"
                value={business.ownerName}
                onChange={
                  handleBusinessChange
                }
              />
            </div>

            <div className="settings-field">
              <label htmlFor="phone">
                Phone Number
              </label>

              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="Enter phone number"
                value={business.phone}
                onChange={
                  handleBusinessChange
                }
              />
            </div>

            <div className="settings-field">
              <label htmlFor="email">
                Email Address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                placeholder="Enter email address"
                value={business.email}
                onChange={
                  handleBusinessChange
                }
              />
            </div>

            <div className="settings-field">
              <label htmlFor="gstNumber">
                GST Number
              </label>

              <input
                id="gstNumber"
                name="gstNumber"
                type="text"
                placeholder="Enter GST number"
                value={business.gstNumber}
                onChange={
                  handleBusinessChange
                }
              />
            </div>

            <div className="settings-field settings-field-full">
              <label htmlFor="address">
                Business Address
              </label>

              <textarea
                id="address"
                name="address"
                rows="4"
                placeholder="Enter complete business address"
                value={business.address}
                onChange={
                  handleBusinessChange
                }
              />
            </div>

          </div>

          <div className="settings-actions">

            <button
              type="submit"
              className="settings-save-button"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : <><AppIcon name="save" /> Save Changes</>}
            </button>

          </div>

        </form>

      </section>

      {/* =================================================
          POS & BILLING
      ================================================= */}

      <section className="settings-card">

        <div className="settings-card-header">

          <div className="settings-icon"><AppIcon name="settings" /></div>

          <div>
            <h2>
              POS & Billing Settings
            </h2>

            <p>
              Configure how billing and
              point-of-sale operations work
            </p>
          </div>

        </div>

        <form
          onSubmit={handleSavePOS}
        >

          <div className="settings-form-grid">

            <div className="settings-field">

              <label>
                Enable Tax / GST
              </label>

              <label className="settings-switch">

                <input
                  type="checkbox"
                  name="enableTax"
                  checked={
                    posSettings.enableTax
                  }
                  onChange={
                    handlePOSChange
                  }
                />

                <span />
              </label>

            </div>

            <div className="settings-field">

              <label htmlFor="defaultTaxRate">
                Default Tax Rate (%)
              </label>

              <input
                id="defaultTaxRate"
                name="defaultTaxRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={
                  posSettings.defaultTaxRate
                }
                onChange={
                  handlePOSChange
                }
                disabled={
                  !posSettings.enableTax
                }
              />

            </div>

            <div className="settings-field">

              <label>
                Enable Discounts
              </label>

              <label className="settings-switch">

                <input
                  type="checkbox"
                  name="enableDiscount"
                  checked={
                    posSettings.enableDiscount
                  }
                  onChange={
                    handlePOSChange
                  }
                />

                <span />
              </label>

            </div>

            <div className="settings-field">

              <label htmlFor="defaultDiscount">
                Default Discount (%)
              </label>

              <input
                id="defaultDiscount"
                name="defaultDiscount"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={
                  posSettings.defaultDiscount
                }
                onChange={
                  handlePOSChange
                }
                disabled={
                  !posSettings.enableDiscount
                }
              />

            </div>

            <div className="settings-field">

              <label htmlFor="invoicePrefix">
                Invoice Prefix
              </label>

              <input
                id="invoicePrefix"
                name="invoicePrefix"
                type="text"
                placeholder="INV-"
                value={
                  posSettings.invoicePrefix
                }
                onChange={
                  handlePOSChange
                }
              />

            </div>

            <div className="settings-field">

              <label htmlFor="startingInvoiceNo">
                Starting Invoice Number
              </label>

              <input
                id="startingInvoiceNo"
                name="startingInvoiceNo"
                type="number"
                min="1"
                value={
                  posSettings.startingInvoiceNo
                }
                onChange={
                  handlePOSChange
                }
              />

            </div>

            <div className="settings-field">

              <label htmlFor="currency">
                Currency
              </label>

              <select
                id="currency"
                name="currency"
                value={
                  posSettings.currency
                }
                onChange={
                  handlePOSChange
                }
              >
                <option value="INR">
                  Indian Rupee (₹)
                </option>

                <option value="USD">
                  US Dollar ($)
                </option>

                <option value="EUR">
                  Euro (€)
                </option>

                <option value="GBP">
                  British Pound (£)
                </option>
              </select>

            </div>

            <div className="settings-field">

              <label>
                Require Customer for Billing
              </label>

              <label className="settings-switch">

                <input
                  type="checkbox"
                  name="requireCustomer"
                  checked={
                    posSettings.requireCustomer
                  }
                  onChange={
                    handlePOSChange
                  }
                />

                <span />
              </label>

            </div>

            <div className="settings-field">

              <label>
                Allow Negative Stock
              </label>

              <label className="settings-switch">

                <input
                  type="checkbox"
                  name="allowNegativeStock"
                  checked={
                    posSettings.allowNegativeStock
                  }
                  onChange={
                    handlePOSChange
                  }
                />

                <span />
              </label>

            </div>

          </div>

          <div className="settings-actions">

            <button
              type="submit"
              className="settings-save-button"
              disabled={savingPOS}
            >
              {savingPOS
                ? "Saving..."
                : <><AppIcon name="save" /> Save POS Settings</>}
            </button>

          </div>

        </form>

      </section>

      {/* =================================================
          RECEIPT & INVOICE
      ================================================= */}

      <section className="settings-card">

        <div className="settings-card-header">

          <div className="settings-icon"><AppIcon name="receipt" /></div>

          <div>
            <h2>
              Receipt & Invoice
            </h2>

            <p>
              Configure how your receipts
              and invoices appear
            </p>
          </div>

        </div>

        <form
          onSubmit={handleSaveReceipt}
        >

          <div className="settings-option-list">

            {[
              {
                name: "showBusinessName",
                title: "Show Business Name",
                description:
                  "Display your business name on receipts",
              },
              {
                name: "showGSTNumber",
                title: "Show GST Number",
                description:
                  "Display GST information on receipts",
              },
              {
                name: "showCustomerDetails",
                title: "Show Customer Details",
                description:
                  "Include customer information on invoices",
              },
              {
                name: "showCashierName",
                title: "Show Cashier Name",
                description:
                  "Display the cashier name on receipts",
              },
              {
                name: "showTaxBreakdown",
                title: "Show Tax Breakdown",
                description:
                  "Display individual tax details on receipts",
              },
              {
                name: "showDiscount",
                title: "Show Discount",
                description:
                  "Display discount information on receipts",
              },
            ].map((item) => (
              <div
                className="settings-option"
                key={item.name}
              >
                <div>
                  <h3>
                    {item.title}
                  </h3>

                  <p>
                    {item.description}
                  </p>
                </div>

                <label className="settings-switch">

                  <input
                    type="checkbox"
                    name={item.name}
                    checked={
                      receiptSettings[
                        item.name
                      ]
                    }
                    onChange={
                      handleReceiptChange
                    }
                  />

                  <span />
                </label>
              </div>
            ))}

            <div className="settings-option">

              <div>
                <h3>
                  Receipt Size
                </h3>

                <p>
                  Select the format used
                  for printing receipts
                </p>
              </div>

              <select
                name="receiptSize"
                value={
                  receiptSettings.receiptSize
                }
                onChange={
                  handleReceiptChange
                }
              >
                <option value="58mm">
                  58mm
                </option>

                <option value="80mm">
                  80mm
                </option>

                <option value="A4">
                  A4
                </option>
              </select>

            </div>

            <div className="settings-field settings-field-full">

              <label htmlFor="footerMessage">
                Receipt Footer Message
              </label>

              <textarea
                id="footerMessage"
                name="footerMessage"
                rows="3"
                placeholder="Thank you for shopping with us!"
                value={
                  receiptSettings.footerMessage
                }
                onChange={
                  handleReceiptChange
                }
              />

            </div>

          </div>

          <div className="settings-actions">

            <button
              type="submit"
              className="settings-save-button"
              disabled={savingReceipt}
            >
              {savingReceipt
                ? "Saving..."
                : <><AppIcon name="save" /> Save Receipt Settings</>}
            </button>

          </div>

        </form>

      </section>

      {/* =================================================
          SECURITY
      ================================================= */}

      <section className="settings-card">

        <div className="settings-card-header">

          <div className="settings-icon"><AppIcon name="shield" /></div>

          <div>
            <h2>
              Security
            </h2>

            <p>
              Manage your account and
              security preferences
            </p>
          </div>

        </div>

        <form
          onSubmit={
            handlePasswordChangeSubmit
          }
        >

          <div className="settings-form-grid">

            <div className="settings-field">

              <label htmlFor="currentPassword">
                Current Password
              </label>

              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                placeholder="Enter current password"
                autoComplete="current-password"
                value={
                  security.currentPassword
                }
                onChange={
                  handleSecurityChange
                }
              />

            </div>

            <div className="settings-field">

              <label htmlFor="newPassword">
                New Password
              </label>

              <input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="Enter new password"
                autoComplete="new-password"
                value={
                  security.newPassword
                }
                onChange={
                  handleSecurityChange
                }
              />

            </div>

            <div className="settings-field">

              <label htmlFor="confirmPassword">
                Confirm New Password
              </label>

              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                autoComplete="new-password"
                value={
                  security.confirmPassword
                }
                onChange={
                  handleSecurityChange
                }
              />

            </div>

          </div>

          <div className="settings-actions">

            <button
              type="submit"
              className="settings-save-button"
              disabled={
                changingPassword
              }
            >
              {changingPassword
                ? "Updating..."
                : <><AppIcon name="key" /> Change Password</>}
            </button>

          </div>

        </form>

      </section>

      {/* =================================================
          BACKUP & DATA
      ================================================= */}

      <section className="settings-card">

        <div className="settings-card-header">

          <div className="settings-icon"><AppIcon name="save" /></div>

          <div>
            <h2>
              Backup & Data
            </h2>

            <p>
              Manage your SmartPOS data
            </p>
          </div>

        </div>

        <div className="settings-option-list">

          <div className="settings-option">

            <div>
              <h3>
                Export Data
              </h3>

              <p>
                Download your POS data
                for backup
              </p>
            </div>

            <button
              type="button"
              className="settings-secondary-button"
              onClick={handleExportData}
              disabled={exportingData}
            >
              {exportingData ? "Preparing Export..." : "Export Data"}
            </button>

          </div>

        </div>

      </section>

      <UPIPaymentSettings embedded showHistory={false} />

    </div>
  );
}

export default Settings;