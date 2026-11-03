const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
})[character]);

export const formatCurrency = (
  amount,
  currency = "INR",
  { minimumFractionDigits = 2, maximumFractionDigits = 2 } = {}
) => (
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(Number(amount) || 0)
);

const numberToWords = (amount) => {
  const ones = [
    "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  const underThousand = (number) => {
    if (number < 20) return ones[number];
    if (number < 100) {
      return `${tens[Math.floor(number / 10)]}${number % 10 ? ` ${ones[number % 10]}` : ""}`;
    }
    return `${ones[Math.floor(number / 100)]} Hundred${number % 100 ? ` ${underThousand(number % 100)}` : ""}`;
  };

  if (amount === 0) return "Zero";

  const groups = [
    { value: 10000000, label: "Crore", plural: "Crores" },
    { value: 100000, label: "Lakh", plural: "Lakhs" },
    { value: 1000, label: "Thousand", plural: "Thousand" },
    { value: 1, label: "" },
  ];
  let remaining = amount;
  const words = [];

  for (const group of groups) {
    const count = Math.floor(remaining / group.value);
    if (count > 0) {
      const label = count === 1 ? group.label : group.plural;
      words.push(`${underThousand(count)}${group.label ? ` ${label}` : ""}`);
      remaining %= group.value;
    }
  }

  return words.join(" ");
};

export const amountInWords = (amount, currency = "INR") => {
  const roundedAmount = Math.round(Number(amount) || 0);
  const currencyName = currency === "USD" ? "Dollar" : "Rupee";
  return `${numberToWords(roundedAmount)} ${currencyName}${roundedAmount === 1 ? "" : "s"} Only`;
};

export const getThermalReceiptMarkup = (
  sale,
  {
    business = {},
    posSettings = {},
    receiptSettings = {},
    cashierName = "",
    paymentReference = "",
    layout = "receipt",
  } = {}
) => {
  const currency = sale.currency || posSettings.currency || "INR";
  const receiptSize = receiptSettings.receiptSize || "80mm";
  const isA4 = receiptSize === "A4";
  const isA4Invoice = isA4 && layout === "a4-invoice";
  const receiptWidth = receiptSize === "58mm" ? "54mm" : receiptSize === "A4" ? "180mm" : "74mm";
  const receiptFont = isA4 ? "Arial, sans-serif" : "monospace";
  const cellPadding = isA4 ? "8px 6px" : "5px 2px";
  const invoiceNumber = sale.invoiceNumber ||
    `${posSettings.invoicePrefix || "INV-"}${(posSettings.startingInvoiceNo ?? 1001) + sale.id - 1}`;
  const showCustomerDetails = receiptSettings.showCustomerDetails ?? true;
  const showTaxBreakdown = receiptSettings.showTaxBreakdown ?? true;
  const showDiscount = receiptSettings.showDiscount ?? true;
  const items = sale.items?.map((item) => {
    const name = item.product?.name || item.productName || "Product";
    const quantity = item.quantity || item.qty || 0;
    const price = Number(item.price || item.product?.sellingPrice || 0);
    const cellBorder = isA4Invoice ? "border-bottom:1px solid #e2e8f0;" : "";

    return `<tr>
      <td style="padding:${cellPadding};text-align:left;overflow-wrap:anywhere;${cellBorder}">${escapeHtml(name)}</td>
      <td style="padding:${cellPadding};text-align:center;white-space:nowrap;${cellBorder}">${escapeHtml(quantity)}</td>
      <td style="padding:${cellPadding};text-align:right;white-space:nowrap;${cellBorder}">${escapeHtml(formatCurrency(price, currency))}</td>
      <td style="padding:${cellPadding};text-align:right;white-space:nowrap;${cellBorder}">${escapeHtml(formatCurrency(quantity * price, currency))}</td>
    </tr>`;
  }).join("") || "";

  const businessName = (receiptSettings.showBusinessName ?? true)
    ? business.businessName || "SmartPOS"
    : "";
  const businessDetails = [
    business.phone,
    business.email,
    business.address,
  ].filter(Boolean).map((value) => `<div>${escapeHtml(value)}</div>`).join("");
  const customerDetails = showCustomerDetails
    ? isA4Invoice
      ? `<span><strong>Customer:</strong> ${escapeHtml(sale.customer?.name || "Walk-in customer")}${sale.customer?.phone ? ` <span style="color:#64748b">(${escapeHtml(sale.customer.phone)})</span>` : ""}</span>`
      : `<p style="margin:4px 0">Customer: ${escapeHtml(sale.customer?.name || "Walk-in customer")}</p>
        ${sale.customer?.phone ? `<p style="margin:4px 0">Phone: ${escapeHtml(sale.customer.phone)}</p>` : ""}`
    : "";
  const cashierDetails = (receiptSettings.showCashierName ?? true) && cashierName
    ? isA4Invoice
      ? `<span><strong>Cashier:</strong> ${escapeHtml(cashierName)}</span>`
      : `<p style="margin:4px 0">Cashier: ${escapeHtml(cashierName)}</p>`
    : "";
  const gstDetails = (receiptSettings.showGSTNumber ?? true) && business.gstNumber
    ? `<p style="margin:4px 0;text-align:center">GSTIN: ${escapeHtml(business.gstNumber)}</p>`
    : "";
  const discountDetails = showDiscount && Number(sale.discountAmount) > 0
    ? `<div>Amount saved (Discount ${escapeHtml(sale.discountRate)}%): ${escapeHtml(formatCurrency(sale.discountAmount, currency))}</div>`
    : "";
  const subtotal = Number(sale.subtotal || 0);
  const discountAmount = Number(sale.discountAmount || 0);
  const taxAmount = Number(sale.taxAmount || 0);
  const roundedTotal = Number(sale.total) || 0;
  const discountedAmount = Math.round((subtotal - discountAmount) * 100) / 100;
  const storedExactTotal = Number.isFinite(Number(sale.roundingAmount))
    ? Math.round((roundedTotal - Number(sale.roundingAmount)) * 100) / 100
    : null;
  const taxIsIncluded = taxAmount > 0 &&
    storedExactTotal !== null &&
    Math.abs(storedExactTotal - discountedAmount) < 0.01;
  const taxableAmount = taxIsIncluded
    ? Math.round((discountedAmount - taxAmount) * 100) / 100
    : discountedAmount;
  const taxDetails = showTaxBreakdown && taxAmount > 0
    ? `<div>GST${taxIsIncluded ? " (included)" : ""} (${escapeHtml(sale.taxRate)}%): ${escapeHtml(formatCurrency(taxAmount, currency))}</div>`
    : "";
  const exactTotal = taxIsIncluded
    ? discountedAmount
    : Math.round((discountedAmount + taxAmount) * 100) / 100;
  const roundedOffAmount = Number.isFinite(Number(sale.roundingAmount))
    ? Number(sale.roundingAmount)
    : Math.round((roundedTotal - exactTotal) * 100) / 100;
  const roundedOffLabel = roundedOffAmount > 0 ? "+" : roundedOffAmount < 0 ? "-" : "";
  const footerMessage = receiptSettings.footerMessage || "Thank you for shopping with us!";
  const paymentReferenceDetails = sale.paymentMethod === "UPI" && paymentReference
    ? `<div style="text-align:left;overflow-wrap:anywhere">Payment reference: ${escapeHtml(paymentReference)}</div>`
    : "";

  const productTable = `<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:inherit;${isA4Invoice ? "border:1px solid #cbd5e1" : ""}">
    <colgroup>
      <col style="width:43%">
      <col style="width:12%">
      <col style="width:22%">
      <col style="width:23%">
    </colgroup>
    <thead>
      <tr style="${isA4Invoice ? "background:#f1f5f9" : "border-bottom:1px solid #000"}">
        <th style="padding:${cellPadding};text-align:left;${isA4Invoice ? "border-bottom:1px solid #94a3b8" : ""}">Product</th>
        <th style="padding:${cellPadding};text-align:center;${isA4Invoice ? "border-bottom:1px solid #94a3b8" : ""}">Qty</th>
        <th style="padding:${cellPadding};text-align:right;${isA4Invoice ? "border-bottom:1px solid #94a3b8" : ""}">Price</th>
        <th style="padding:${cellPadding};text-align:right;${isA4Invoice ? "border-bottom:1px solid #94a3b8" : ""}">Amount</th>
      </tr>
    </thead>
    <tbody>${items}</tbody>
  </table>`;

  return `    <div id="thermal-receipt" style="width:${receiptWidth};padding:${isA4 ? "0" : "4mm"};background:#fff;font-family:${receiptFont};font-size:14px">
    ${businessName ? `<h3 style="text-align:center">${escapeHtml(businessName)}</h3>` : ""}
    ${businessDetails ? `<div style="text-align:center">${businessDetails}</div>` : ""}
    ${gstDetails}
    ${isA4Invoice ? "" : "<hr>"}
    <div style="display:flex;justify-content:space-between;gap:4px;margin:2px 0;line-height:1.15;white-space:nowrap;font-size:12px">
      <span>Invoice: ${escapeHtml(invoiceNumber)}</span>
      <span>${escapeHtml(new Date(sale.createdAt).toLocaleDateString("en-IN"))}</span>
    </div>
    ${isA4Invoice ? "" : "<hr>"}
    ${isA4Invoice
      ? customerDetails || cashierDetails
        ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin:10px 0">${customerDetails}${cashierDetails}</div>`
        : ""
      : `${customerDetails}${cashierDetails}`}
    ${productTable}
    ${isA4Invoice ? "" : "<hr>"}
    <div style="text-align:right">
      ${Number(sale.taxAmount) > 0 || Number(sale.discountAmount) > 0
        ? `<div>Subtotal: ${escapeHtml(formatCurrency(sale.subtotal, currency))}</div>` : ""}
      ${discountDetails ? `<div>${discountDetails}</div>` : ""}
      ${taxIsIncluded && showTaxBreakdown
        ? `<div>Taxable value: ${escapeHtml(formatCurrency(taxableAmount, currency))}</div>` : ""}
      ${taxDetails ? `<div>${taxDetails}</div>` : ""}
      <div>Rounded off: ${escapeHtml(roundedOffLabel + formatCurrency(Math.abs(roundedOffAmount), currency))}</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:8px 0">
      <span>Payment: ${escapeHtml(sale.paymentMethod || "Cash")}</span>
      <strong style="text-align:right;white-space:nowrap">Total: ${escapeHtml(formatCurrency(sale.total, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 }))}</strong>
    </div>
    ${paymentReferenceDetails}
    <div style="text-align:left;overflow-wrap:anywhere">${escapeHtml(amountInWords(roundedTotal, currency))}</div>
    <hr>
    <p style="text-align:center">${escapeHtml(footerMessage)}</p>
  </div>`;
};

export const getReturnReceiptMarkup = (
  sale,
  saleReturn,
  { business = {}, receiptSettings = {} } = {}
) => {
  const currency = sale.currency || "INR";
  const businessName = (receiptSettings.showBusinessName ?? true)
    ? business.businessName || "SmartPOS"
    : "";
  const returnedItems = saleReturn.items.map((item) => {
    const saleItem = item.saleItem;
    return `<tr>
      <td>${escapeHtml(saleItem?.product?.name || "Product")}</td>
      <td style="text-align:center">${escapeHtml(item.quantity)}</td>
      <td style="text-align:right">${escapeHtml(formatCurrency(item.refundAmount, currency))}</td>
    </tr>`;
  }).join("");
  const replacementItems = saleReturn.exchangeItems.map((item) => `<tr>
    <td>${escapeHtml(item.product?.name || "Product")}</td>
    <td style="text-align:center">${escapeHtml(item.quantity)}</td>
    <td style="text-align:right">${escapeHtml(formatCurrency(item.amount, currency))}</td>
  </tr>`).join("");
  const settlement = Number(saleReturn.settlementAmount);
  const settlementDetails = settlement > 0
    ? `<div style="display:flex;justify-content:space-between"><span>Balance collected (${escapeHtml(saleReturn.paymentMethod || "Payment")})</span><strong>${escapeHtml(formatCurrency(settlement, currency))}</strong></div>`
    : settlement < 0
      ? `<div style="display:flex;justify-content:space-between"><span>Refund due</span><strong>${escapeHtml(formatCurrency(Math.abs(settlement), currency))}</strong></div>`
      : "<div style=\"display:flex;justify-content:space-between\"><span>Settlement</span><strong>Even exchange</strong></div>";
  const footerMessage = receiptSettings.footerMessage || "Thank you for shopping with us!";

  return `<div id="thermal-receipt" style="width:74mm;padding:4mm;background:#fff;font-family:monospace;font-size:13px">
    ${businessName ? `<h3 style="text-align:center">${escapeHtml(businessName)}</h3>` : ""}
    ${business.address ? `<div style="text-align:center">${escapeHtml(business.address)}</div>` : ""}
    ${business.phone ? `<div style="text-align:center">${escapeHtml(business.phone)}</div>` : ""}
    <hr>
    <h3 style="text-align:center">Return / Exchange Receipt</h3>
    <div>Adjustment: #${escapeHtml(saleReturn.id)}</div>
    <div>Original invoice: ${escapeHtml(sale.invoiceNumber || `#${sale.id}`)}</div>
    <div>Date: ${escapeHtml(new Date(saleReturn.createdAt).toLocaleString("en-IN"))}</div>
    ${saleReturn.processedBy?.name ? `<div>Processed by: ${escapeHtml(saleReturn.processedBy.name)}</div>` : ""}
    <hr>
    ${returnedItems ? `<strong>Returned items</strong>
      <table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Product</th><th>Qty</th><th style="text-align:right">Value</th></tr></thead><tbody>${returnedItems}</tbody></table>` : ""}
    ${replacementItems ? `<strong>Replacement items</strong>
      <table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Product</th><th>Qty</th><th style="text-align:right">Value</th></tr></thead><tbody>${replacementItems}</tbody></table>` : ""}
    <hr>
    <div style="display:flex;justify-content:space-between"><span>Returned value</span><span>${escapeHtml(formatCurrency(saleReturn.total, currency))}</span></div>
    <div style="display:flex;justify-content:space-between"><span>Replacement total</span><span>${escapeHtml(formatCurrency(saleReturn.replacementTotal, currency))}</span></div>
    ${settlementDetails}
    <hr>
    <p style="text-align:center">${escapeHtml(footerMessage)}</p>
  </div>`;
};

export const getReceiptPrintStyles = (receiptSize = "80mm") => {
  if (receiptSize === "A4") {
    return `
      @page { size: A4; margin: 12mm; }
      html, body { width: auto; margin: 0; padding: 0; background: #fff; color: #172033; }
      body { font-family: Arial, sans-serif; }
      #thermal-receipt {
        width: 180mm !important;
        box-sizing: border-box;
        margin: 0 auto;
        font: 14px/1.45 Arial, sans-serif !important;
        color: #172033 !important;
      }
      #thermal-receipt table { margin: 16px 0; }
      #thermal-receipt th, #thermal-receipt td {
        padding: 8px 6px !important;
        border-bottom: 1px solid #cbd5e1;
      }
      #thermal-receipt th { background: #f1f5f9; text-align: left; }
      #thermal-receipt hr { border: 0; border-top: 1px solid #cbd5e1; margin: 14px 0; }
      #thermal-receipt h3 { margin: 8px 0; }
    `;
  }

  const pageWidth = receiptSize === "58mm" ? "58mm" : "80mm";
  const contentWidth = receiptSize === "58mm" ? "54mm" : "74mm";
  return `
    @page { size: ${pageWidth} auto; margin: 0; }
    html, body { width: ${pageWidth}; margin: 0; padding: 0; background: #fff; }
    body { font-family: monospace; color: #000; }
    #thermal-receipt { width: ${contentWidth} !important; box-sizing: border-box; margin: 0 auto; }
    @media screen { body { width: ${pageWidth}; margin: 0 auto; } }
  `;
};
