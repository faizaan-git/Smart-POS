import { useEffect, useRef, useState } from "react";
import "./CameraBarcodeScanner.css";

const BARCODE_FORMATS = [
  "codabar",
  "code_39",
  "code_93",
  "code_128",
  "ean_8",
  "ean_13",
  "itf",
  "upc_a",
  "upc_e",
];

const getCameraErrorMessage = (error) => {
  if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
    return "Camera permission was denied. Allow camera access in your browser settings, then try again.";
  }
  if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
    return "No camera was found on this device.";
  }
  if (error.name === "NotReadableError" || error.name === "TrackStartError") {
    return "The camera is already in use by another app.";
  }
  return "Could not start the camera. Check camera permissions and try again.";
};

function CameraBarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    const videoElement = videoRef.current;
    let active = true;
    let stream;
    let scannerControls;
    let detectTimer;

    const startZXingScanner = async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (!active || !videoElement) return;

        const reader = new BrowserMultiFormatReader(undefined, 150);
        scannerControls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: { facingMode: { ideal: "environment" } },
          },
          videoElement,
          (result, _error, controls) => {
            if (!active || !result) return;
            controls.stop();
            onDetectedRef.current(result.getText());
          }
        );

        if (!active) scannerControls.stop();
      } catch (cameraError) {
        console.error("Could not initialize barcode scanning fallback:", cameraError);
        if (active) setErrorMessage(getCameraErrorMessage(cameraError));
      }
    };

    const startCamera = async () => {
      if (!window.isSecureContext) {
        setErrorMessage("Camera scanning requires HTTPS. Open this page using a secure HTTPS address.");
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMessage("This browser does not support camera access.");
        return;
      }

      const Detector = globalThis.BarcodeDetector;
      if (!Detector) {
        await startZXingScanner();
        return;
      }

      try {
        const supportedFormats = await Detector.getSupportedFormats();
        if (!active) return;

        const formats = BARCODE_FORMATS.filter((format) => supportedFormats.includes(format));
        if (formats.length === 0) {
          await startZXingScanner();
          return;
        }

        const detector = new Detector({ formats });
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (!videoElement) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        videoElement.srcObject = stream;
        await videoElement.play();

        const detectBarcode = async () => {
          if (!active || !videoElement) return;

          try {
            const detected = await detector.detect(videoElement);
            if (!active) return;

            const barcode = detected.find((result) => result.rawValue)?.rawValue;
            if (barcode) {
              onDetectedRef.current(barcode);
              return;
            }
          } catch (detectionError) {
            console.error("Camera barcode detection failed:", detectionError);
            if (active) {
              stream?.getTracks().forEach((track) => track.stop());
              videoElement.srcObject = null;
              setErrorMessage("Barcode scanning failed. Try entering the barcode manually.");
            }
            return;
          }

          if (active) detectTimer = window.setTimeout(detectBarcode, 150);
        };

        void detectBarcode();
      } catch (cameraError) {
        console.error("Could not initialize camera barcode scanner:", cameraError);
        stream?.getTracks().forEach((track) => track.stop());
        if (videoElement) videoElement.srcObject = null;
        if (active) setErrorMessage(getCameraErrorMessage(cameraError));
      }
    };

    void startCamera();

    return () => {
      active = false;
      window.clearTimeout(detectTimer);
      scannerControls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
      if (videoElement) videoElement.srcObject = null;
    };
  }, []);

  return (
    <div className="billing-camera-overlay">
      <section
        className="billing-camera-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-camera-title"
      >
        <header className="billing-camera-heading">
          <h2 id="billing-camera-title">Scan product barcode</h2>
          <button type="button" onClick={onClose} aria-label="Close camera scanner">
            Close
          </button>
        </header>
        {errorMessage ? (
          <p className="billing-camera-error" role="alert">{errorMessage}</p>
        ) : (
          <>
            <div className="billing-camera-preview">
              <video ref={videoRef} autoPlay muted playsInline aria-label="Camera preview" />
              <span className="billing-camera-guide" aria-hidden="true" />
            </div>
            <p className="billing-camera-hint" role="status">
              Point the rear camera at a product barcode.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

export default CameraBarcodeScanner;
