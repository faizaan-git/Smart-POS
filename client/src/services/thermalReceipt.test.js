import assert from "node:assert/strict";
import test from "node:test";
import { getThermalReceiptMarkup } from "./thermalReceipt.js";

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
