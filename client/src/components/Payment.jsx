import AppIcon from "./AppIcon";
import { formatCurrency } from "../services/thermalReceipt";

function Payment({
  total,
  amounts,
  currency = "INR",
  settingsLoaded,
  cashReceived,
  setCashReceived,
  paymentMethod,
  setPaymentMethod,
  completeSale,
}) {
  const received = Number(cashReceived || 0);
  const change = Math.max(0, received - total);
  const insufficientCash = paymentMethod === "Cash" && received < total;

  return (
    <section className="billing-panel billing-payment">
      <div className="billing-panel-heading">
        <div className="billing-heading-icon">
          <AppIcon name="creditCard" />
        </div>
        <div>
          <h2>Payment</h2>
          <p>Review total and choose a payment method</p>
        </div>
      </div>

      <div className="billing-total-card">
        <span>Amount due</span>
        <strong>{formatCurrency(total, currency)}</strong>
        <small>GST is included in product prices</small>
      </div>

      {amounts && (
        <div className="billing-payment-breakdown">
          {amounts.taxRate > 0 && (
            <div><span>Taxable value</span><strong>{formatCurrency(amounts.taxableAmount, currency)}</strong></div>
          )}
          {amounts.taxRate > 0 && (
            <div><span>GST included ({amounts.taxRate}%)</span><strong>{formatCurrency(amounts.taxAmount, currency)}</strong></div>
          )}
          <div>
            <span>{amounts.taxRate > 0 ? "Subtotal (GST incl.)" : "Subtotal"}</span>
            <strong>{formatCurrency(amounts.subtotal, currency)}</strong>
          </div>
          {amounts.discountAmount > 0 && (
            <div><span>Discount ({amounts.discountRate}%)</span><strong>-{formatCurrency(amounts.discountAmount, currency)}</strong></div>
          )}
          {amounts.roundingAmount > 0 && (
            <div><span>Rounded off</span><strong>{formatCurrency(amounts.roundingAmount, currency)}</strong></div>
          )}
        </div>
      )}

      <div className="billing-payment-fields">
        <label>
          Payment method
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <option>Cash</option>
            <option>Card</option>
            <option>UPI</option>
          </select>
        </label>

        {paymentMethod === "Cash" && (
          <>
            <label>
              Cash received
              <div className="billing-cash-input">
                <span>{formatCurrency(0, currency).replace(/[\d.,\s]/g, "")}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>
            </label>

            <div className="billing-change-row">
              <span>Change due</span>
              <strong>{formatCurrency(change, currency)}</strong>
            </div>
            {insufficientCash && cashReceived !== "" && (
              <p className="billing-cash-warning">Cash received is less than the amount due.</p>
            )}
          </>
        )}
      </div>

      <button
        type="button"
        className="billing-complete-button"
        onClick={completeSale}
        disabled={!settingsLoaded || total <= 0 || insufficientCash}
      >
        <AppIcon name="check" />
        Complete sale
      </button>
      <p className="billing-secure-note">
        {settingsLoaded ? "Sale and inventory are saved together." : "Loading billing settings…"}
      </p>
    </section>
  );
}

export default Payment;
