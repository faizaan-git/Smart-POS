import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import InvoicePrint from "./InvoicePrint";
import AppIcon from "./AppIcon";
import api from "../services/api";
import {
  getReceiptPrintStyles,
  getThermalReceiptMarkup,
} from "../services/thermalReceipt";
import "./InvoiceModal.css";

function InvoiceModal({ sale, close }) {
  const saleId = sale?.id;
  const [showReceipt, setShowReceipt] = useState(false);
  const [settingsState, setSettingsState] = useState({
    saleId: null,
    context: null,
    error: "",
  });

  useEffect(() => {
    const bodyOverflow = document.body.style.overflow;
    const documentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = documentOverflow;
    };
  }, []);

  useEffect(() => {
    if (saleId == null) return undefined;
    let cancelled = false;

    Promise.all([
      api.get("/settings/business"),
      api.get("/pos-settings"),
      api.get("/receipt-settings"),
    ])
      .then(([businessResponse, posResponse, receiptResponse]) => {
        if (cancelled) return;
        const currentUser = JSON.parse(sessionStorage.getItem("user") || "null");
        setSettingsState({
          saleId,
          context: {
            business: businessResponse.data || {},
            posSettings: posResponse.data || {},
            receiptSettings: receiptResponse.data || {},
            cashierName: currentUser?.name || "",
          },
          error: "",
        });
      })
      .catch((error) => {
        console.error("Failed to load invoice settings:", error);
        if (cancelled) return;
        const message = error.response?.data?.message || "Failed to load invoice details.";
        setSettingsState({ saleId, context: null, error: message });
        toast.error(message);
      });

    return () => {
      cancelled = true;
    };
  }, [saleId]);

  if (!sale) return null;

  const receiptContext = settingsState.saleId === sale.id
    ? settingsState.context
    : null;
  const settingsError = settingsState.saleId === sale.id
    ? settingsState.error
    : "";
  const settingsLoading = settingsState.saleId !== sale.id;

  const getA4Markup = () => {
    if (!receiptContext) return "";
    return getThermalReceiptMarkup(sale, {
      ...receiptContext,
      layout: "a4-invoice",
      receiptSettings: {
        ...receiptContext.receiptSettings,
        receiptSize: "A4",
      },
    });
  };

  const printInvoice = () => {
    const printWindow = window.open("", "smartpos-a4-invoice", "popup,width=1000,height=900");
    if (!printWindow) {
      toast.warning("Allow pop-ups to print the invoice.");
      return;
    }
    if (!receiptContext) {
      printWindow.close();
      toast.error(settingsError || "Invoice details are still loading.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>Invoice ${sale.invoiceNumber || sale.id}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>${getReceiptPrintStyles("A4")}</style>
        </head>
        <body>${getA4Markup()}</body>
      </html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onafterprint = () => printWindow.close();
    printWindow.setTimeout(() => printWindow.print(), 400);
  };

  const printReceipt = async () => {
    setShowReceipt(true);

    const printWindow = window.open("", "smartpos-sales-receipt", "popup,width=360,height=720");
    if (!printWindow) {
      toast.warning("Allow pop-ups to print the receipt.");
      return;
    }

    try {
      const [businessResponse, posResponse, receiptResponse] = await Promise.all([
        api.get("/settings/business"),
        api.get("/pos-settings"),
        api.get("/receipt-settings"),
      ]);
      const currentUser = JSON.parse(sessionStorage.getItem("user") || "null");
      const posSettings = posResponse.data || {};
      const receiptSettings = receiptResponse.data || {};
      const receiptSize = receiptSettings.receiptSize || "80mm";
      const receiptMarkup = getThermalReceiptMarkup(sale, {
        business: businessResponse.data || {},
        posSettings,
        receiptSettings,
        cashierName: currentUser?.name || "",
      });

      printWindow.document.open();
      printWindow.document.write(`<!doctype html>
        <html>
          <head>
            <title>SmartPOS Receipt</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>${getReceiptPrintStyles(receiptSize)}</style>
          </head>
          <body>${receiptMarkup}</body>
        </html>`);
      printWindow.document.close();
      printWindow.focus();
      printWindow.onafterprint = () => printWindow.close();
      printWindow.setTimeout(() => printWindow.print(), 400);
    } catch (error) {
      console.error("Failed to load receipt settings:", error);
      printWindow.close();
      toast.error(error.response?.data?.message || "Failed to prepare receipt.");
    }
  };

  const downloadPDF = async () => {
    if (!receiptContext) {
      toast.error(settingsError || "Invoice details are still loading.");
      return;
    }

    let captureHost;
    try {
      const [
        { default: html2canvas },
        { default: jsPDF },
      ] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      captureHost = document.createElement("div");
      Object.assign(captureHost.style, {
        position: "fixed",
        left: "-10000px",
        top: "0",
        width: "180mm",
        background: "#fff",
      });
      captureHost.innerHTML = `<style>${getReceiptPrintStyles("A4")}</style>${getA4Markup()}`;
      document.body.appendChild(captureHost);

      const invoice = captureHost.querySelector("#thermal-receipt");
      const canvas = await html2canvas(invoice, {
        backgroundColor: "#fff",
        scale: 2,
        windowWidth: invoice.scrollWidth,
      });
      const pdf = new jsPDF("p", "mm", "a4");
      const margin = 12;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      const imageHeight = (canvas.height * contentWidth) / canvas.width;
      const pageCount = Math.ceil(imageHeight / contentHeight);
      const sourcePageHeight = Math.floor((contentHeight * canvas.width) / contentWidth);

      for (let page = 0; page < pageCount; page += 1) {
        if (page > 0) pdf.addPage();
        const sourceY = page * sourcePageHeight;
        const sliceHeight = Math.min(sourcePageHeight, canvas.height - sourceY);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        pageCanvas.getContext("2d").drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );
        pdf.addImage(
          pageCanvas.toDataURL("image/png"),
          "PNG",
          margin,
          margin,
          contentWidth,
          (sliceHeight * contentWidth) / canvas.width
        );
      }

      const invoiceNumber = String(sale.invoiceNumber || sale.id).replace(/[<>:"/\\|?*]/g, "-");
      pdf.save(`Invoice-${invoiceNumber}.pdf`);
    } catch (error) {
      console.error("Failed to create invoice PDF:", error);
      toast.error("Failed to create the invoice PDF.");
    } finally {
      captureHost?.remove();
    }
  };

  const a4Markup = getA4Markup();

  return (
    <div className="invoice-modal-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) close();
    }}>
      <section
        className="invoice-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Invoice ${sale.invoiceNumber || sale.id}`}
      >
        <div className="invoice-modal-document">
          {showReceipt ? (
            <div id="thermal-print" className="invoice-modal-receipt">
              <div dangerouslySetInnerHTML={{ __html: getThermalReceiptMarkup(sale, {
                ...(receiptContext || {}),
                receiptSettings: receiptContext?.receiptSettings || {},
              }) }} />
            </div>
          ) : (
            <InvoicePrint
              markup={a4Markup}
              loading={settingsLoading || (!receiptContext && !settingsError)}
              error={settingsError}
            />
          )}
        </div>

        <div className="invoice-modal-actions">
          <button onClick={printInvoice} style={buttonStyle("#16a34a")}>
            <><AppIcon name="print" /> Print Invoice</>
          </button>

          <button onClick={printReceipt} style={buttonStyle("#9333ea")}>
            <><AppIcon name="receipt" /> Print Receipt</>
          </button>

          <button onClick={downloadPDF} style={buttonStyle("#2563eb")}>
            <><AppIcon name="pdf" /> PDF</>
          </button>

          <button onClick={close} style={buttonStyle("#dc2626")}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

function buttonStyle(color) {
  return {
    padding: "10px 15px",
    background: color,
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  };
}

export default InvoiceModal;
