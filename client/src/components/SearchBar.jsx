import { useMemo, useState } from "react";
import AppIcon from "./AppIcon";
import BarcodeSearch from "./BarcodeSearch";

function SearchBar({
  products,
  addToCart,
  currency,
  barcode,
  setBarcode,
  scanBarcode,
  barcodeInputRef,
  onBarcodeKeyDown,
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return [];

    return products
      .filter((product) =>
        product.name?.toLocaleLowerCase().includes(term) ||
        String(product.barcode || "").toLocaleLowerCase().includes(term) ||
        String(product.category || "").toLocaleLowerCase().includes(term)
      )
      .slice(0, 8);
  }, [products, query]);

  const handleAddProduct = (product) => {
    if (addToCart(product)) setQuery("");
  };

  return (
    <div className="billing-search-row">
      <div className="billing-product-search">
        <label className="billing-search-field">
          <AppIcon name="search" />
          <input
            type="search"
            aria-label="Search products by name or barcode"
            aria-expanded={query.trim().length > 0}
            placeholder="Search product name or barcode"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {query.trim() && (
          <ul className="billing-product-search-results" aria-label="Product search results">
            {matches.length ? matches.map((product) => (
              <li key={product.id}>
                <button type="button" onClick={() => handleAddProduct(product)}>
                  <span className="billing-product-search-copy">
                    <strong>{product.name}</strong>
                    <small>{product.barcode} · {product.category || "Uncategorized"}</small>
                  </span>
                  <span className="billing-product-search-price">
                    {new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency,
                      minimumFractionDigits: 2,
                    }).format(Number(product.sellingPrice))}
                  </span>
                </button>
              </li>
            )) : (
              <li className="billing-product-search-empty">No matching products found.</li>
            )}
          </ul>
        )}
      </div>
      <BarcodeSearch
        barcode={barcode}
        setBarcode={setBarcode}
        scanBarcode={scanBarcode}
        barcodeInputRef={barcodeInputRef}
        onBarcodeKeyDown={onBarcodeKeyDown}
      />
    </div>
  );
}

export default SearchBar;