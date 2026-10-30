function InvoicePrint({ markup, loading, error }) {
  return (
    <div id="invoice-print" className="invoice-modal-invoice">
      {loading && <p>Loading invoice details...</p>}
      {error && <p role="alert">{error}</p>}
      {markup && <div dangerouslySetInnerHTML={{ __html: markup }} />}
    </div>
  );
}

export default InvoicePrint;
