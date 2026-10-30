import AppIcon from "./AppIcon";
import BarcodeSearch from "./BarcodeSearch";

function SearchBar({
  search,
  setSearch,
  barcode,
  setBarcode,
  scanBarcode,
  barcodeInputRef,
  onBarcodeKeyDown,
}) {
  return (
    <div className="billing-search-row">
      <label className="billing-search-field">
        <AppIcon name="search" />
        <input
          type="text"
          aria-label="Search products"
          placeholder="Search by product name, category or barcode"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
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