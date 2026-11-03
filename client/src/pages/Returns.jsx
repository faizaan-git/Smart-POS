import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import AppIcon from "../components/AppIcon";
import PageTitle from "../components/PageTitle";
import SaleReturnModal from "../components/SaleReturnModal";
import api from "../services/api";
import {
  formatCurrency,
  getReceiptPrintStyles,
  getReturnReceiptMarkup,
} from "../services/thermalReceipt";
import "./styles/Sales.css";

function Returns() {
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);

  useEffect(() => {
    let active = true;
    const loadSales = async () => {
      try {
        const response = await api.get("/sales-history");
        if (active) setSales(response.data);
      } catch (error) {
        console.error("Could not load sales for returns:", error);
        toast.error(error.response?.data?.message || "Failed to load sales for returns.");
      }
    };

    void loadSales();
    return () => {
      active = false;
    };
  }, []);

  const query = search.trim().toLowerCase();
  const filteredSales = sales.filter((sale) => (
    sale.id.toString().includes(query) ||
    sale.invoiceNumber?.toLowerCase().includes(query)
  ));

  const recordSaleReturn = async (updatedSale, saleReturn, receiptWindow) => {
    setSales((currentSales) => currentSales.map((sale) => (
      sale.id === updatedSale.id ? updatedSale : sale
    )));
    setSelectedSale(null);
    try {
      const [businessResponse, receiptResponse] = await Promise.all([
        api.get("/settings/business"),
        api.get("/receipt-settings"),
      ]);
      const receiptSettings = receiptResponse.data || {};
      const receiptSize = receiptSettings.receiptSize || "80mm";
      const receiptMarkup = getReturnReceiptMarkup(updatedSale, saleReturn, {
        business: businessResponse.data || {},
        receiptSettings,
      });

      receiptWindow.document.open();
      receiptWindow.document.write(`<!doctype html>
        <html>
          <head>
            <title>Return ${saleReturn.id} · ${updatedSale.invoiceNumber || updatedSale.id}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>${getReceiptPrintStyles(receiptSize)}</style>
          </head>
          <body>${receiptMarkup}</body>
        </html>`);
      receiptWindow.document.close();
      receiptWindow.focus();
      receiptWindow.onafterprint = () => receiptWindow.close();
      receiptWindow.setTimeout(() => receiptWindow.print(), 400);

      const settlement = Number(saleReturn.settlementAmount);
      toast.success(settlement > 0
        ? `Exchange recorded. ${formatCurrency(settlement, updatedSale.currency)} collected by ${saleReturn.paymentMethod}.`
        : settlement < 0
          ? `Return recorded. ${formatCurrency(Math.abs(settlement), updatedSale.currency)} refund is due.`
          : "Even exchange recorded.");
    } catch (error) {
      console.error("Return was recorded, but its receipt could not be prepared:", error);
      if (receiptWindow && !receiptWindow.closed) receiptWindow.close();
      toast.error("Return recorded, but the updated receipt could not be prepared.");
    }
  };

  return (
    <div className="admin-sales-page">
      <PageTitle icon={<AppIcon name="receipt" />}>Returns</PageTitle>
      <p>Find a sale by invoice or ID to record and review product returns.</p>

      <input
        type="search"
        aria-label="Search invoice number or sale ID"
        placeholder="Search invoice number or sale ID..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        style={{
          padding: "12px",
          width: "min(100%, 360px)",
          marginBottom: "20px",
          borderRadius: "8px",
          border: "1px solid #ddd",
        }}
      />

      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "12px",
          boxShadow: "0 3px 10px rgba(0,0,0,.1)",
        }}
      >
        <table className="admin-sales-history-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Date</th>
              <th>Settlement</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {!filteredSales.length ? (
              <tr>
                <td colSpan="6" align="center">No sales found</td>
              </tr>
            ) : filteredSales.map((sale) => {
              const settlementAmount = (sale.returns || []).reduce(
                (total, saleReturn) => total + Number(
                  saleReturn.settlementAmount ?? -Number(saleReturn.total)
                ),
                0
              );
              const hasRemainingItems = sale.items.some(
                (item) => getReturnedQuantity(sale, item.id) < item.quantity
              );

              return (
                <tr key={sale.id}>
                  <td>{sale.invoiceNumber || `#${sale.id}`}</td>
                  <td>{formatCurrency(sale.total, sale.currency)}</td>
                  <td>{sale.paymentMethod || "Cash"}</td>
                  <td>{new Date(sale.createdAt).toLocaleString()}</td>
                  <td>
                    {(sale.returns || []).length
                      ? settlementAmount > 0
                        ? `${formatCurrency(settlementAmount, sale.currency)} collected`
                        : settlementAmount < 0
                          ? `${formatCurrency(Math.abs(settlementAmount), sale.currency)} refund due`
                          : "Even exchange"
                      : "None"}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setSelectedSale(sale)}
                      disabled={!hasRemainingItems}
                      style={{
                        padding: "8px 15px",
                        background: hasRemainingItems ? "#15803d" : "#64748b",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: hasRemainingItems ? "pointer" : "default",
                      }}
                    >
                      {hasRemainingItems
                        ? (sale.returns?.length ? "Record / view return" : "Record return")
                        : "Fully returned"}
                    </button>
                    {(sale.returns || []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedSale(sale)}
                        style={{
                          marginLeft: "8px",
                          padding: "8px 15px",
                          border: "1px solid #94a3b8",
                          borderRadius: "6px",
                          background: "transparent",
                          cursor: "pointer",
                        }}
                      >
                        History
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedSale && (
        <SaleReturnModal
          key={selectedSale.id}
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
          onReturned={recordSaleReturn}
        />
      )}
    </div>
  );
}

function getReturnedQuantity(sale, saleItemId) {
  return (sale.returns || []).reduce(
    (total, saleReturn) => total + saleReturn.items
      .filter((item) => item.saleItemId === saleItemId)
      .reduce((itemTotal, item) => itemTotal + item.quantity, 0),
    0
  );
}

export default Returns;
