import assert from "node:assert/strict";
import test from "node:test";
import { getReturnReceiptMarkup, getThermalReceiptMarkup } from "./thermalReceipt.js";

test("shows included GST as a breakdown without counting it twice in the receipt", () => {
  const markup = getThermalReceiptMarkup({
    id: 1,
    subtotal: 118,
    discountAmount: 11.8,
    discountRate: 10,
    taxAmount: 16.2,
    taxRate: 18,
    roundingAmount: 0.8,
    total: 107,
    currency: "INR",
    paymentMethod: "Cash",
    createdAt: "2026-10-14T12:00:00.000Z",
    items: [],
  });

  assert.match(markup, /Taxable value:/);
  assert.match(markup, /GST \(included\) \(18%\):/);
  assert.match(markup, /Total: ₹107/);
});

test("prints the payment reference only on UPI receipts", () => {
  const sale = {
    id: 2,
    total: 100,
    paymentMethod: "UPI",
    createdAt: "2026-10-14T12:00:00.000Z",
    items: [],
  };
  const upiMarkup = getThermalReceiptMarkup(sale, { paymentReference: "SP-123" });
  const cashMarkup = getThermalReceiptMarkup(
    { ...sale, paymentMethod: "Cash" },
    { paymentReference: "SP-123" }
  );

  assert.match(upiMarkup, /Payment reference: SP-123/);
  assert.doesNotMatch(cashMarkup, /Payment reference:/);
});

test("prints return and exchange items with the final settlement on an adjustment receipt", () => {
  const markup = getReturnReceiptMarkup({
    id: 12,
    invoiceNumber: "INV-1012",
    currency: "INR",
  }, {
    id: 45,
    createdAt: "2026-10-14T12:00:00.000Z",
    total: "90.00",
    replacementTotal: "150.00",
    settlementAmount: "60.00",
    paymentMethod: "UPI",
    processedBy: { name: "Manager" },
    items: [{
      quantity: 1,
      refundAmount: "90.00",
      saleItem: { product: { name: "Old product" } },
    }],
    exchangeItems: [{
      quantity: 1,
      amount: "150.00",
      product: { name: "New product" },
    }],
  }, {
    business: { businessName: "SmartPOS Shop" },
  });

  assert.match(markup, /Return \/ Exchange Receipt/);
  assert.match(markup, /Original invoice: INV-1012/);
  assert.match(markup, /Old product/);
  assert.match(markup, /New product/);
  assert.match(markup, /Balance collected \(UPI\)/);
  assert.match(markup, /₹60\.00/);
});
