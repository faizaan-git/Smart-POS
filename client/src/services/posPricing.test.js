import assert from "node:assert/strict";
import test from "node:test";
import { calculatePOSAmounts } from "./posPricing.js";

test("discounts a GST-inclusive subtotal and splits GST without adding it again", () => {
  const amounts = calculatePOSAmounts(118, {
    enableTax: true,
    defaultTaxRate: 18,
    enableDiscount: true,
    defaultDiscount: 10,
  });

  assert.equal(amounts.subtotal, 118);
  assert.equal(amounts.discountAmount, 11.8);
  assert.equal(amounts.taxableAmount, 90);
  assert.equal(amounts.taxAmount, 16.2);
  assert.equal(amounts.exactTotal, 106.2);
  assert.equal(amounts.total, 107);
});

test("keeps the discounted subtotal as the total when tax is disabled", () => {
  const amounts = calculatePOSAmounts(100, {
    enableTax: false,
    defaultTaxRate: 18,
    enableDiscount: true,
    defaultDiscount: 10,
  });

  assert.equal(amounts.discountAmount, 10);
  assert.equal(amounts.taxableAmount, 90);
  assert.equal(amounts.taxAmount, 0);
  assert.equal(amounts.total, 90);
});
