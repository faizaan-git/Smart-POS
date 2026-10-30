import { useState } from "react";
import AppIcon from "./AppIcon";
import CameraBarcodeScanner from "./CameraBarcodeScanner";

function BarcodeSearch({
  barcode,
  setBarcode,
  scanBarcode,
  barcodeInputRef,
  onBarcodeKeyDown,
}) {
  const [cameraOpen, setCameraOpen] = useState(false);

  return (
    <>
      <div className="billing-barcode-controls">
        <label className="billing-search-field billing-barcode-field">
          <AppIcon name="camera" />
          <input
            type="text"
            aria-label="Scan barcode"
            ref={barcodeInputRef}
            placeholder="Scan or enter barcode"
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
            onKeyDown={(event) => {
              onBarcodeKeyDown(event);
              if (event.key === "Enter") {
                event.preventDefault();
                void scanBarcode(event.currentTarget.value);
              }
            }}
          />
          {barcode && (
            <button
              type="button"
              onClick={() => {
                barcodeInputRef.current?.focus();
                void scanBarcode(barcode);
              }}
            >
              Add
            </button>
          )}
        </label>
        <button
          type="button"
          className="billing-camera-button"
          onClick={() => setCameraOpen(true)}
        >
          <AppIcon name="camera" />
          Scan
        </button>
      </div>
      {cameraOpen && (
        <CameraBarcodeScanner
          onDetected={(value) => {
            setCameraOpen(false);
            void scanBarcode(value);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </>
  );
}

export default BarcodeSearch;
