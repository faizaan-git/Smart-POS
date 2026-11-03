import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import api from "../services/api";
import { formatCurrency } from "../services/thermalReceipt";
import "./UPIPaymentModal.css";

function UPIPaymentModal({ payment, sale, onPaymentComplete, onPrintReceipt, onClose }) {
  const [status, setStatus] = useState(payment.status);
  const [confirming, setConfirming] = useState(false);
  const completionNotified = useRef(false);
  const onPaymentCompleteRef = useRef(onPaymentComplete);

  useEffect(() => {
    onPaymentCompleteRef.current = onPaymentComplete;
  }, [onPaymentComplete]);

  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      try {
        const response = await api.get(`/payments/${payment.id}`);
        if (!active) return;
        const latest = response.data;
        setStatus(latest.status);
        if (latest.status === "SUCCESS" && !completionNotified.current) {
          completionNotified.current = true;
          onPaymentCompleteRef.current(latest.sale);
        }
      } catch (error) {
        if (active) {
          console.error("Could not refresh UPI payment status:", error);
        }
      }
    };

    checkStatus();
    const interval = window.setInterval(checkStatus, 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [payment.id]);

  const approvePayment = async () => {
    const receiptWindow = window.open(
      "",
      "smartpos-thermal-receipt",
      "popup,width=360,height=720"
    );
    if (!receiptWindow) {
      toast.error("Allow pop-ups to approve this payment and print its receipt.");
      return;
    }

    setConfirming(true);
    try {
      const response = await api.post(`/payments/${payment.id}/approve`);
      const approvedPayment = response.data.payment;
      setStatus(approvedPayment.status);
      if (approvedPayment.status === "SUCCESS" && !completionNotified.current) {
        completionNotified.current = true;
        onPaymentCompleteRef.current(approvedPayment.sale);
        onPrintReceipt(approvedPayment.sale, receiptWindow, approvedPayment.transactionReference);
      }
    } catch (error) {
      if (!receiptWindow.closed) receiptWindow.close();
      toast.error(error.response?.data?.message || "Could not approve UPI payment");
    } finally {
      setConfirming(false);
    }
  };

  const isPending = status === "PENDING";

  return (
    <div className="upi-modal-backdrop" role="presentation">
      <section
        className="upi-payment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upi-payment-heading"
      >
        <header className="upi-modal-header">
          <div>
            <p className="upi-brand">SMARTPOS PAYMENT</p>
            <h2 id="upi-payment-heading">
              {status === "SUCCESS" ? "PAYMENT RECEIVED!" : "Complete UPI payment"}
            </h2>
          </div>
          {!isPending && (
            <button type="button" className="upi-close-button" onClick={onClose}>
              Close
            </button>
          )}
        </header>

        <div className="upi-payment-amount">
          <strong className="upi-merchant-business-name">{payment.businessName}</strong>
          <span>{status === "SUCCESS" ? "Paid" : "Amount to pay"}</span>
          <strong>{formatCurrency(payment.amount, payment.currency)}</strong>
          <span>Bill {sale.invoiceNumber || `#${sale.id}`}</span>
        </div>

        {isPending && (
          <>
            <img className="upi-payment-qr" src={payment.qrCodeDataUrl} alt="Fixed-amount UPI payment QR code" />
            <p className="upi-reference">Payment reference: {payment.transactionReference}</p>
            <p className="upi-reference">
              QR expires: {new Date(payment.expiresAt).toLocaleString()}
            </p>

            {payment.instructions && (
              <p className="upi-instructions">{payment.instructions}</p>
            )}
            <ol className="upi-steps">
              <li>Scan the QR code or open your UPI app.</li>
              <li>Check the amount before paying.</li>
              <li>Complete the payment, then return to SmartPOS.</li>
            </ol>
            <p className="upi-status-line" role="status">Status: {status}</p>
            <button
              type="button"
              className="upi-approve-button"
              onClick={approvePayment}
              disabled={confirming}
            >
              {confirming ? "Approving…" : "Approve & Print Receipt"}
            </button>
          </>
        )}

        {status === "SUCCESS" && (
          <div className="upi-final-status upi-success-status" role="status">
            <strong>Payment approved by staff.</strong>
            <span>Payment Method: UPI</span>
            <span>Transaction Reference: {payment.transactionReference}</span>
            <span>Status: SUCCESS</span>
            <p>Thank you for your payment.</p>
            <button type="button" onClick={onClose}>Return to billing</button>
          </div>
        )}

        {(status === "FAILED" || status === "EXPIRED") && (
          <div className="upi-final-status upi-failed-status" role="status">
            <strong>{status === "EXPIRED" ? "This payment request expired." : "This payment could not be completed."}</strong>
            <span>The bill remains unpaid. Contact the merchant or return to billing to retry.</span>
            <button type="button" onClick={onClose}>Return to billing</button>
          </div>
        )}
      </section>
    </div>
  );
}

export default UPIPaymentModal;
