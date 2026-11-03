import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../services/api";
import { formatCurrency } from "../services/thermalReceipt";
import CameraBarcodeScanner from "./CameraBarcodeScanner";
import "./SaleReturnModal.css";

function SaleReturnModal({ sale, onClose, onReturned }) {
  const [quantities, setQuantities] = useState(() => {
    const alreadyReturned = new Map();
    for (const saleReturn of sale.returns || []) {
      for (const item of saleReturn.items) {
        alreadyReturned.set(
          item.saleItemId,
          (alreadyReturned.get(item.saleItemId) || 0) + item.quantity
        );
      }
    }

    return Object.fromEntries(sale.items.map((item) => [
      item.id,
      Math.max(0, item.quantity - (alreadyReturned.get(item.id) || 0)),
    ]));
  });
  const [products, setProducts] = useState([]);
  const [replacementRows, setReplacementRows] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.get("/products")
      .then((response) => {
        if (active) setProducts(response.data);
      })
      .catch((error) => {
        console.error("Could not load products for exchange:", error);
        toast.error(error.response?.data?.message || "Could not load replacement products.");
      });

    return () => {
      active = false;
    };
  }, []);

  const returnedQuantityFor = (saleItemId) => (sale.returns || []).reduce(
    (total, saleReturn) => total + saleReturn.items
      .filter((item) => item.saleItemId === saleItemId)
      .reduce((itemTotal, item) => itemTotal + item.quantity, 0),
    0
  );

  const returnItems = sale.items.map((item) => ({
    saleItemId: item.id,
    quantity: Number(quantities[item.id]) || 0,
  })).filter((item) => item.quantity > 0);

  const replacements = replacementRows
    .filter((row) => row.productId && Number(row.quantity) > 0)
    .map((row) => ({ productId: Number(row.productId), quantity: Number(row.quantity) }));
  const matchingProducts = productSearch.trim()
    ? products.filter((product) => (
      product.name?.toLowerCase().includes(productSearch.trim().toLowerCase()) ||
      String(product.barcode || "").toLowerCase().includes(productSearch.trim().toLowerCase()) ||
      String(product.category || "").toLowerCase().includes(productSearch.trim().toLowerCase())
    )).slice(0, 6)
    : [];

  const addReplacementProduct = (product) => {
    if (!product || Number(product.stock) < 1) {
      toast.warning(product ? `${product.name} is out of stock.` : "Product not found.");
      return;
    }

    const selected = replacementRows.find((row) => Number(row.productId) === product.id);
    if (selected) {
      if (Number(selected.quantity) >= Number(product.stock)) {
        toast.warning(`Only ${product.stock} ${product.name} available in stock.`);
        return;
      }
      setReplacementRows((rows) => rows.map((row) => row.key === selected.key
        ? { ...row, quantity: Number(row.quantity) + 1 }
        : row));
    } else {
      setReplacementRows((rows) => [
        ...rows,
        { key: `${Date.now()}-${Math.random()}`, productId: product.id, quantity: 1 },
      ]);
    }
    setProductSearch("");
  };

  const addScannedProduct = (rawBarcode) => {
    const code = String(rawBarcode || "").trim();
    if (!code) {
      toast.warning("Scan or enter a product barcode.");
      return;
    }
    const product = products.find((item) => String(item.barcode || "").trim() === code);
    if (!product) {
      toast.error(`Product not found for barcode: ${code}`);
    } else {
      addReplacementProduct(product);
    }
    setBarcode("");
  };
  const originalSubtotal = Number(sale.subtotal) || sale.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
  const saleTotalCents = Math.round(Number(sale.total) * 100);
  const previousQuantities = new Map();
  let previouslyRefundedCents = 0;
  for (const saleReturn of sale.returns || []) {
    previouslyRefundedCents += Math.round(Number(saleReturn.total) * 100);
    for (const item of saleReturn.items) {
      previousQuantities.set(
        item.saleItemId,
        (previousQuantities.get(item.saleItemId) || 0) + item.quantity
      );
    }
  }
  const returnLineValues = returnItems.map(({ saleItemId, quantity }) => {
    const item = sale.items.find((saleItem) => saleItem.id === saleItemId);
    const previousQuantity = previousQuantities.get(saleItemId) || 0;
    const returnedBefore = Math.round(
      saleTotalCents * Number(item.price) * previousQuantity / originalSubtotal
    );
    const returnedAfter = Math.round(
      saleTotalCents * Number(item.price) * (previousQuantity + quantity) / originalSubtotal
    );
    return { saleItemId, quantity, refundCents: Math.max(0, returnedAfter - returnedBefore) };
  });
  const allItemsReturned = sale.items.every((item) => (
    (previousQuantities.get(item.id) || 0) +
      (returnItems.find((returnedItem) => returnedItem.saleItemId === item.id)?.quantity || 0) >= item.quantity
  ));
  if (allItemsReturned && returnLineValues.length) {
    let adjustment = saleTotalCents - previouslyRefundedCents -
      returnLineValues.reduce((total, item) => total + item.refundCents, 0);
    for (const item of returnLineValues) {
      if (adjustment >= 0) {
        item.refundCents += adjustment;
        break;
      }
      const reduction = Math.min(item.refundCents, -adjustment);
      item.refundCents -= reduction;
      adjustment += reduction;
    }
  }
  const returnedValueCents = returnLineValues.reduce((total, item) => total + item.refundCents, 0);
  const replacementValueCents = replacements.reduce((total, item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return total + Math.round((Number(product?.sellingPrice) || 0) * 100) * item.quantity;
  }, 0);
  const estimate = {
    returnedValue: returnedValueCents / 100,
    replacementValue: replacementValueCents / 100,
    amountDue: (replacementValueCents - returnedValueCents) / 100,
  };

  const submitReturn = async (event) => {
    event.preventDefault();
    if (!returnItems.length) {
      toast.warning("Choose at least one item and quantity to return.");
      return;
    }

    if (estimate.amountDue > 0 && !paymentReceived) {
      toast.warning("Confirm that the customer paid the exchange balance before continuing.");
      return;
    }

    const receiptWindow = window.open("", "smartpos-return-receipt", "popup,width=360,height=720");
    if (!receiptWindow) {
      toast.error("Allow pop-ups to generate the return or exchange receipt.");
      return;
    }

    setSaving(true);
    try {
      const response = await api.post(`/sales-history/${sale.id}/returns`, {
        items: returnItems,
        replacements,
        paymentMethod: estimate.amountDue > 0 ? paymentMethod : null,
        paymentReceived: estimate.amountDue > 0 && paymentReceived,
      });
      onReturned(response.data.sale, response.data.saleReturn, receiptWindow);
    } catch (error) {
      if (!receiptWindow.closed) receiptWindow.close();
      console.error("Could not process sale return:", error);
      toast.error(error.response?.data?.message || "Could not process the return.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="sale-return-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        className="sale-return-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-return-heading"
      >
        <header className="sale-return-header">
          <div>
            <h2 id="sale-return-heading">Return items</h2>
            <p>Sale #{sale.invoiceNumber || sale.id}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close return dialog">
            ×
          </button>
        </header>

        <form onSubmit={submitReturn}>
          <div className="sale-return-items">
            {sale.items.map((item) => {
              const returned = returnedQuantityFor(item.id);
              const remaining = item.quantity - returned;
              return (
                <div className="sale-return-item" key={item.id}>
                  <div>
                    <strong>{item.product?.name || "Product"}</strong>
                    <span>Sold: {item.quantity} · Returned: {returned} · Available: {remaining}</span>
                  </div>
                  <label>
                    <span>Qty</span>
                    <input
                      type="number"
                      min="0"
                      max={remaining}
                      step="1"
                      value={quantities[item.id] ?? ""}
                      disabled={remaining === 0 || saving}
                      aria-label={`Quantity to return for ${item.product?.name || "product"}`}
                      onChange={(event) => setQuantities((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))}
                    />
                  </label>
                </div>
              );
            })}
          </div>

          <section className="sale-exchange-section">
            <header>
              <div>
                <h3>Exchange products</h3>
                <p>Search products or scan a barcode to add replacements.</p>
              </div>
            </header>

            <label className="sale-exchange-search">
              <span>Search products</span>
              <input
                type="search"
                placeholder="Search by product name, barcode, or category"
                value={productSearch}
                disabled={saving}
                onChange={(event) => setProductSearch(event.target.value)}
              />
            </label>
            {productSearch.trim() && (
              <ul className="sale-exchange-search-results" aria-label="Replacement product search results">
                {matchingProducts.length ? matchingProducts.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => addReplacementProduct(product)}
                      disabled={saving || Number(product.stock) < 1}
                    >
                      <span>
                        <strong>{product.name}</strong>
                        <small>{product.barcode} · {product.category || "Uncategorized"} · Stock {product.stock}</small>
                      </span>
                      <span>{formatCurrency(product.sellingPrice, sale.currency)}</span>
                    </button>
                  </li>
                )) : <li className="sale-exchange-search-empty">No matching products found.</li>}
              </ul>
            )}

            <div className="sale-exchange-barcode-row">
              <label>
                <span>Scan barcode</span>
                <input
                  type="text"
                  placeholder="Scan or enter barcode, then press Enter"
                  value={barcode}
                  disabled={saving}
                  onChange={(event) => setBarcode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addScannedProduct(barcode);
                    }
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => addScannedProduct(barcode)}
                disabled={saving || !barcode.trim()}
              >
                Add barcode
              </button>
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                disabled={saving}
              >
                Scan with camera
              </button>
            </div>
            {cameraOpen && (
              <CameraBarcodeScanner
                onDetected={(value) => {
                  setCameraOpen(false);
                  addScannedProduct(value);
                }}
                onClose={() => setCameraOpen(false)}
              />
            )}

            {replacementRows.map((row) => (
              <div className="sale-exchange-item" key={row.key}>
                <div className="sale-exchange-product-copy">
                  <strong>{products.find((product) => product.id === Number(row.productId))?.name || "Product"}</strong>
                  <span>{formatCurrency(
                    products.find((product) => product.id === Number(row.productId))?.sellingPrice,
                    sale.currency
                  )}</span>
                </div>
                <label>
                  <span>Qty</span>
                  <input
                    type="number"
                    min="1"
                    max={products.find((product) => product.id === Number(row.productId))?.stock || 1}
                    step="1"
                    value={row.quantity}
                    disabled={saving}
                    onChange={(event) => setReplacementRows((rows) => rows.map((item) => (
                      item.key === row.key
                        ? { ...item, quantity: event.target.value }
                        : item
                    )))}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setReplacementRows((rows) => rows.filter((item) => item.key !== row.key))}
                  disabled={saving}
                  aria-label="Remove replacement product"
                >
                  Remove
                </button>
              </div>
            ))}
          </section>

          <div className="sale-exchange-settlement" aria-live="polite">
            <span>Returned value</span>
            <strong>{formatCurrency(estimate.returnedValue, sale.currency)}</strong>
            <span>Replacement products</span>
            <strong>{formatCurrency(estimate.replacementValue, sale.currency)}</strong>
            {estimate.amountDue > 0 ? (
              <>
                <span>Balance to collect</span>
                <strong>{formatCurrency(estimate.amountDue, sale.currency)}</strong>
              </>
            ) : estimate.amountDue < 0 ? (
              <>
                <span>Refund due</span>
                <strong>{formatCurrency(Math.abs(estimate.amountDue), sale.currency)}</strong>
              </>
            ) : (
              <>
                <span>Settlement</span>
                <strong>Even exchange</strong>
              </>
            )}
          </div>

          {estimate.amountDue > 0 && (
            <section className="sale-exchange-payment">
              <label>
                Payment method
                <select
                  value={paymentMethod}
                  disabled={saving}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="UPI">UPI</option>
                </select>
              </label>
              <label className="sale-exchange-payment-confirmation">
                <input
                  type="checkbox"
                  checked={paymentReceived}
                  disabled={saving}
                  onChange={(event) => setPaymentReceived(event.target.checked)}
                />
                <span>
                  I have received {formatCurrency(estimate.amountDue, sale.currency)} by {paymentMethod}.
                  For UPI, confirm the payment in the UPI app.
                </span>
              </label>
            </section>
          )}

          {(sale.returns || []).length > 0 && (
            <section className="sale-return-history" aria-label="Return history">
              <h3>Previous returns and exchanges</h3>
              {[...sale.returns].sort(
                (left, right) => new Date(right.createdAt) - new Date(left.createdAt)
              ).map((saleReturn) => (
                <article className="sale-return-history-entry" key={saleReturn.id}>
                  <div>
                    <strong>
                      {Number(saleReturn.settlementAmount) > 0
                        ? `Collected ${formatCurrency(saleReturn.settlementAmount, sale.currency)}`
                        : Number(saleReturn.settlementAmount) < 0
                          ? `Refund due ${formatCurrency(Math.abs(Number(saleReturn.settlementAmount)), sale.currency)}`
                          : "Even exchange"}
                    </strong>
                    <span>
                      {new Date(saleReturn.createdAt).toLocaleString()}
                      {saleReturn.processedBy?.name ? ` · ${saleReturn.processedBy.name}` : ""}
                    </span>
                  </div>
                  <ul>
                    {saleReturn.items.map((item) => (
                      <li key={`return-${item.id}`}>
                        Returned: {item.saleItem?.product?.name || "Product"} × {item.quantity}
                      </li>
                    ))}
                    {saleReturn.exchangeItems.map((item) => (
                      <li key={`exchange-${item.id}`}>
                        Replacement: {item.product?.name || "Product"} × {item.quantity}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </section>
          )}

          <p className="sale-return-note">
            Returned items are restocked and replacement items reduce stock. Any refund due must be issued manually.
          </p>

          <footer className="sale-return-actions">
            <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" disabled={saving}>
              {saving ? "Recording…" : "Record return"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default SaleReturnModal;
