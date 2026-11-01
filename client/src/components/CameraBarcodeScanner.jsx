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
  "qr_code",
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
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [errorMessage, setErrorMessage] = useState(() => {
    if (!window.isSecureContext) {
      return "Camera scanning requires HTTPS. Open this page using a secure HTTPS address.";
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      return "This browser does not support camera access.";
    }
    return "";
  });

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (errorMessage) return undefined;
    let active = true;

    const refreshCameraList = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!active) return;
        const videoDevices = devices.filter((device) => device.kind === "videoinput");
        setCameras(videoDevices);
        setSelectedCameraId((current) => {
          if (current && videoDevices.some((device) => device.deviceId === current)) {
            return current;
          }
          const externalCamera = videoDevices.find((device) =>
            /usb|external|webcam|logitech|brio|c920/i.test(device.label)
          );
          return externalCamera?.deviceId || videoDevices[0]?.deviceId || "";
        });
        if (videoDevices.length) setErrorMessage("");
      } catch (cameraError) {
        console.error("Could not refresh camera list:", cameraError);
        if (active) setErrorMessage("Could not list cameras. Check browser camera permissions and try again.");
      }
    };

    const loadCameras = async () => {
      try {
        const permissionStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
        permissionStream.getTracks().forEach((track) => track.stop());
        await refreshCameraList();
      } catch (cameraError) {
        console.error("Could not enumerate cameras:", cameraError);
        if (active && cameraError.name !== "NotFoundError" && cameraError.name !== "DevicesNotFoundError") {
          setErrorMessage(getCameraErrorMessage(cameraError));
        } else if (active) {
          setCameras([]);
          setErrorMessage("");
        }
      }
    };

    const handleDeviceChange = () => {
      void refreshCameraList();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    void loadCameras();

    return () => {
      active = false;
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [errorMessage]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!selectedCameraId || !videoElement) return undefined;

    let active = true;
    let stream;
    let scannerControls;
    let detectTimer;

    const startZXingScanner = async () => {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (!active) return;
      const reader = new BrowserMultiFormatReader(undefined, 150);
      scannerControls = await reader.decodeFromVideoDevice(
        selectedCameraId,
        videoElement,
        (result, _error, controls) => {
          if (!active || !result) return;
          controls.stop();
          onDetectedRef.current(result.getText());
        }
      );
      if (!active) scannerControls.stop();
    };

    const startCamera = async () => {
      try {
        const Detector = globalThis.BarcodeDetector;
        if (!Detector) {
          await startZXingScanner();
          return;
        }

        const supportedFormats = await Detector.getSupportedFormats();
        if (!active) return;
        const formats = BARCODE_FORMATS.filter((format) => supportedFormats.includes(format));
        if (!formats.length) {
          await startZXingScanner();
          return;
        }

        const detector = new Detector({ formats });
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { deviceId: { exact: selectedCameraId } },
        });
        if (!active) {
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
        console.error("Could not initialize selected barcode camera:", cameraError);
        scannerControls?.stop();
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
  }, [selectedCameraId]);

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
            {cameras.length > 0 ? (
              <>
                <label className="billing-camera-selector">
                  Camera
                  <select
                    value={selectedCameraId}
                    onChange={(event) => setSelectedCameraId(event.target.value)}
                  >
                    {cameras.map((camera, index) => (
                      <option key={camera.deviceId} value={camera.deviceId}>
                        {camera.label || `Camera ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="billing-camera-preview">
                  <video ref={videoRef} autoPlay muted playsInline aria-label="Camera preview" />
                  <span className="billing-camera-guide" aria-hidden="true" />
                </div>
                <p className="billing-camera-hint" role="status">
                  Select the connected QR/barcode camera and point it at the code.
                </p>
              </>
            ) : (
              <p className="billing-camera-error" role="status">
                No camera is available to show here. If your USB QR scanner types the scanned code like a keyboard, close this window, focus the barcode field, and scan there. Keyboard scanners do not appear in camera lists.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default CameraBarcodeScanner;
