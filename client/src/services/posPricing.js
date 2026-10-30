export const defaultPOSSettings = {
  enableTax: true,
  defaultTaxRate: 18,
  enableDiscount: true,
  defaultDiscount: 0,
  invoicePrefix: "INV-",
  startingInvoiceNo: 1001,
  currency: "INR",
  allowNegativeStock: false,
};

export const calculatePOSAmounts = (subtotal, settings = defaultPOSSettings) => {
  const roundCurrency = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;
  const roundedSubtotal = roundCurrency(subtotal);
  const discountRate = settings.enableDiscount
    ? Number(settings.defaultDiscount) || 0
    : 0;
  const taxRate = settings.enableTax
    ? Number(settings.defaultTaxRate) || 0
    : 0;
  const discountAmount = roundCurrency(roundedSubtotal * discountRate / 100);
  const discountedAmount = roundCurrency(roundedSubtotal - discountAmount);
  const taxableAmount = taxRate > 0
    ? roundCurrency(discountedAmount / (1 + taxRate / 100))
    : discountedAmount;
  const taxAmount = roundCurrency(discountedAmount - taxableAmount);
  const exactTotal = discountedAmount;
  const total = Math.ceil(exactTotal);

  return {
    subtotal: roundedSubtotal,
    discountRate,
    discountAmount,
    taxableAmount,
    taxRate,
    taxAmount,
    exactTotal,
    roundingAmount: roundCurrency(total - exactTotal),
    total,
  };
};
