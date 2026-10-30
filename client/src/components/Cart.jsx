import AppIcon from "./AppIcon";
import { formatCurrency } from "../services/thermalReceipt";

function Cart({ cart, increaseQty, decreaseQty, currency = "INR", scannerConnected = false }) {
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <section className="billing-panel billing-cart">
      <div
        className={`billing-scanner-status${scannerConnected ? " is-connected" : ""}`}
        role="status"
        aria-live="polite"
        title="Scanner status is based on recent rapid barcode input; keyboard-wedge scanners cannot report physical connection."
      >
        <span className="billing-scanner-status-light" aria-hidden="true" />
        {scannerConnected ? "Scanner detected" : "Scanner not detected"}
      </div>
      <div className="billing-panel-heading">
        <div className="billing-heading-icon">
          <AppIcon name="cart" />
        </div>
        <div>
          <h2>Current order</h2>
          <p>{itemCount} {itemCount === 1 ? "item" : "items"} in cart</p>
        </div>
        <span className="billing-count">{itemCount}</span>
      </div>

      {cart.length === 0 ? (
        <div className="billing-cart-empty">
          <span className="billing-empty-icon"><AppIcon name="cart" /></span>
          <strong>Your order is empty</strong>
          <span>Add products to get started.</span>
        </div>
      ) : (
        <div className="billing-cart-items">
          {cart.map((item) => (
            <article className="billing-cart-item" key={item.id}>
              <div className="billing-cart-item-info">
                <strong>{item.name}</strong>
                <span>{formatCurrency(item.sellingPrice, currency)} each</span>
              </div>
              <div className="billing-quantity">
                <button
                  type="button"
                  onClick={() => decreaseQty(item.id)}
                  aria-label={`Remove one ${item.name}`}
                >
                  −
                </button>
                <span>{item.qty}</span>
                <button
                  type="button"
                  onClick={() => increaseQty(item.id)}
                  aria-label={`Add one ${item.name}`}
                >
                  +
                </button>
              </div>
              <strong className="billing-line-total">
                {formatCurrency(item.qty * Number(item.sellingPrice), currency)}
              </strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default Cart;
