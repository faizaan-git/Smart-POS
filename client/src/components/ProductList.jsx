import AppIcon from "./AppIcon";

function ProductList({ products, addToCart, currency = "INR", restoreBarcodeFocus }) {
  return (
    <section className="billing-panel billing-products">
      <div className="billing-panel-heading">
        <div className="billing-heading-icon">
          <AppIcon name="box" />
        </div>
        <div>
          <h2>Products</h2>
          <p>Choose an item to add it to the order</p>
        </div>
        <span className="billing-count">{products.length}</span>
      </div>

      <div className="billing-product-table-wrap">
        <table className="billing-product-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>Availability</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {products.length > 0 ? (
              products.map((product) => {
                const outOfStock = Number(product.stock) <= 0;
                return (
                  <tr key={product.id}>
                    <td>
                      <div className="billing-product-name">{product.name}</div>
                      <div className="billing-product-meta">
                        {product.category || "Uncategorized"} · {product.barcode}
                      </div>
                    </td>
                    <td className="billing-product-price">
                      {new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency,
                        minimumFractionDigits: 2,
                      }).format(Number(product.sellingPrice))}
                    </td>
                    <td>
                      <span className={`billing-stock${outOfStock ? " is-empty" : ""}`}>
                        <span />
                        {outOfStock ? "Out of stock" : `${product.stock} in stock`}
                      </span>
                    </td>
                    <td className="billing-product-action">
                      <button
                        type="button"
                        className="billing-add-button"
                        onClick={() => {
                          if (addToCart(product)) restoreBarcodeFocus();
                        }}
                      >
                        <AppIcon name="cart" />
                        Add
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="billing-products-empty" colSpan="4">
                  <span className="billing-empty-icon"><AppIcon name="search" /></span>
                  <strong>No products found</strong>
                  <span>Try another search or barcode.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default ProductList;
