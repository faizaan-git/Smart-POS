import { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api";
import { toast } from "react-toastify";

import SearchBar from "../components/SearchBar";
import ProductList from "../components/ProductList";
import Cart from "../components/Cart";
import Payment from "../components/Payment";
import PageTitle from "../components/PageTitle";
import { getCashierPreferences } from "../services/cashierPreferences";
import { subscribeToBusinessSettings } from "../services/businessSettingsEvents";
import { calculatePOSAmounts, defaultPOSSettings } from "../services/posPricing";
import { FaCog } from "react-icons/fa";
import AppIcon from "../components/AppIcon";
import {
  getReceiptPrintStyles,
  getThermalReceiptMarkup,
} from "../services/thermalReceipt";
import "./styles/Billing.css";

const getHeldBillsStorageKey = () => {
  const user = JSON.parse(sessionStorage.getItem("user") || "null");
  return `smartpos-held-bills-${user?.id || user?.role || "guest"}`;
};

const readHeldBills = (storageKey) => {
  try {
    const savedBills = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(savedBills)) return [];

    return savedBills.filter((bill) =>
      bill &&
      typeof bill.id === "string" &&
      Array.isArray(bill.cart) &&
      bill.cart.length > 0 &&
      bill.cart.every((item) =>
        item &&
        (typeof item.id === "string" || typeof item.id === "number") &&
        Number.isFinite(Number(item.qty)) &&
        Number(item.qty) > 0
      )
    );
  } catch (error) {
    console.error("Failed to read held bills:", error);
    return [];
  }
};

const createHeldBill = ({ cart, selectedCustomer, paymentMethod, cashReceived }) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  createdAt: new Date().toISOString(),
  cart: cart.map((item) => ({ ...item })),
  selectedCustomer,
  paymentMethod,
  cashReceived,
});

function Billing({ isCashier = false, onOpenSettings }) {
  const [heldBillsStorageKey] = useState(getHeldBillsStorageKey);
  const [heldBills, setHeldBills] = useState(() => readHeldBills(heldBillsStorageKey));
  const [showHeldBills, setShowHeldBills] = useState(false);

  const [customers, setCustomers] = useState([]);

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [products, setProducts] = useState([]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  const [cart, setCart] = useState([]);
  const [businessSettings, setBusinessSettings] = useState({});
  const [posSettings, setPosSettings] = useState(defaultPOSSettings);
  const [receiptSettings, setReceiptSettings] = useState({});
  const [billingSettingsLoaded, setBillingSettingsLoaded] = useState(false);

  const [search, setSearch] = useState("");

  const [barcode, setBarcode] = useState("");
  const [scannerConnected, setScannerConnected] = useState(false);
  const scannerKeySequence = useRef({ count: 0, lastKeyAt: 0 });
  const scannerStatusTimeout = useRef(null);
  const scannerInputRef = useRef(null);
  const scanQueueRef = useRef(Promise.resolve());
  const cartRef = useRef([]);

  const [cashReceived, setCashReceived] = useState("");

  const [paymentMethod, setPaymentMethod] = useState(
    () => getCashierPreferences().defaultPaymentMethod
  );

  const markScannerDetected = useCallback(() => {
    setScannerConnected(true);
    window.clearTimeout(scannerStatusTimeout.current);
    scannerStatusTimeout.current = window.setTimeout(() => {
      setScannerConnected(false);
      scannerKeySequence.current = { count: 0, lastKeyAt: 0 };
    }, 30000);
  }, []);

  useEffect(() => {
    scannerInputRef.current?.focus();
    return () => window.clearTimeout(scannerStatusTimeout.current);
  }, []);

  const setCurrentCart = (nextCart) => {
    const resolvedCart = typeof nextCart === "function" ? nextCart(cartRef.current) : nextCart;
    cartRef.current = resolvedCart;
    setCart(resolvedCart);
  };

  useEffect(() => {
    try {
      localStorage.setItem(heldBillsStorageKey, JSON.stringify(heldBills));
    } catch (error) {
      console.error("Failed to save held bills:", error);
      toast.error("Could not save held bills on this device.");
    }
  }, [heldBills, heldBillsStorageKey]);

  const clearCurrentBill = () => {
    setCurrentCart([]);
    setSelectedCustomer("");
    setCashReceived("");
    setPaymentMethod(getCashierPreferences().defaultPaymentMethod);
    setSearch("");
    setBarcode("");
  };

  const holdCurrentBill = ({ showMessage = true } = {}) => {
    if (cart.length === 0) return false;
    const heldBill = createHeldBill({ cart, selectedCustomer, paymentMethod, cashReceived });
    setHeldBills((current) => [heldBill, ...current]);
    clearCurrentBill();
    if (showMessage) toast.success("Bill held. You can start a new bill.");
    return true;
  };

  const continueHeldBill = (heldBill) => {
    if (!productsLoaded) {
      toast.info("Products are still loading. Please try again shortly.");
      return;
    }
    const productsById = new Map(products.map((product) => [product.id, product]));
    const unavailableProducts = heldBill.cart.filter((item) => !productsById.has(item.id));
    if (unavailableProducts.length > 0) {
      toast.error("This bill contains products that are no longer available. It remains on hold.");
      return;
    }

    const nextHeldBills = heldBills.filter((item) => item.id !== heldBill.id);
    if (cart.length > 0) {
      nextHeldBills.unshift(createHeldBill({ cart, selectedCustomer, paymentMethod, cashReceived }));
    }
    const restoredCart = heldBill.cart.map((item) => ({
      ...productsById.get(item.id),
      qty: item.qty,
    }));

    setHeldBills(nextHeldBills);
    setCurrentCart(restoredCart);
    setSelectedCustomer(heldBill.selectedCustomer || "");
    setPaymentMethod(heldBill.paymentMethod || getCashierPreferences().defaultPaymentMethod);
    setCashReceived(heldBill.cashReceived || "");
    setShowHeldBills(false);
    setSearch("");
    setBarcode("");
    toast.success(cart.length > 0
      ? "Previous bill held and selected bill restored."
      : "Held bill restored.");
  };


  // Load Products

  const loadProducts = async () => {

    try {

      const res =
        await api.get("/products");

      setProducts(res.data);


    } catch(error){

      console.error(error);

      toast.error("Failed to load products");

    }

  };





  useEffect(() => {
    let active = true;
    let receivedSettingsUpdate = false;
    const unsubscribeFromBusinessSettings = subscribeToBusinessSettings((settings) => {
      receivedSettingsUpdate = true;
      setBusinessSettings(settings || {});
    });

    const loadInitialData = async () => {
      try {
        const response = await api.get("/products");
        if (active) setProducts(response.data);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load products");
      } finally {
        if (active) setProductsLoaded(true);
      }

      try {
        const response = await api.get("/customers");
        if (active) setCustomers(response.data);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load customers");
      }

      try {
        const [businessResponse, posResponse, receiptResponse] = await Promise.all([
          api.get("/settings/business"),
          api.get("/pos-settings"),
          api.get("/receipt-settings"),
        ]);
        if (active) {
          if (!receivedSettingsUpdate) {
            setBusinessSettings(businessResponse.data || {});
          }
          setPosSettings({
            ...defaultPOSSettings,
            ...(posResponse.data || {}),
          });
          setReceiptSettings(receiptResponse.data || {});
          setBillingSettingsLoaded(true);
        }
      } catch (error) {
        console.error("Failed to load billing and receipt settings:", error);
        if (active) {
          toast.error("Failed to load billing and receipt settings. Reload before completing a sale.");
        }
      }
    };

    void loadInitialData();
    return () => {
      active = false;
      unsubscribeFromBusinessSettings();
    };
  }, []);





  // Filter Products

  const filteredProducts = products.filter((product)=>{

    const key =
      search.toLowerCase();


    return (

      product.name
      .toLowerCase()
      .includes(key)


      ||

      product.category
      .toLowerCase()
      .includes(key)


      ||

      product.barcode
      .includes(key)

    );

  });







  // Add Product

  const addToCart = (product) => {
    const price = Number(product?.sellingPrice);
    const stock = Number(product?.stock);
    if (
      !product ||
      (typeof product.id !== "number" && typeof product.id !== "string") ||
      !Number.isFinite(price) ||
      !Number.isFinite(stock)
    ) {
      console.error("Invalid product data received for billing:", product);
      toast.error("This product has invalid billing data and cannot be added.");
      return false;
    }

    const existing = cartRef.current.find((item) => item.id === product.id);
    if (!posSettings.allowNegativeStock && (existing?.qty || 0) >= stock) {
      toast.error(stock > 0
        ? `Insufficient stock for ${product.name}. Only ${stock} available.`
        : `${product.name} is out of stock.`);
      return false;
    }

    setCurrentCart((current) => {
      const currentProduct = current.find((item) => item.id === product.id);
      return currentProduct
        ? current.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
        : [...current, { ...product, qty: 1 }];
    });

    toast.success(`${product.name} added`);
    return true;
  };







  // Barcode Scan

  const handleBarcodeKeyDown = (event) => {
    if (event.key.length !== 1) return;
    const now = performance.now();
    const sequence = scannerKeySequence.current;
    sequence.count = now - sequence.lastKeyAt <= 150 ? sequence.count + 1 : 1;
    sequence.lastKeyAt = now;
    if (sequence.count >= 3) markScannerDetected();
  };

  const scanBarcode = (rawBarcode = barcode) => {
    const code = String(rawBarcode ?? "").trim();
    if (!code) {
      toast.warning("Scan or enter a barcode first.");
      scannerInputRef.current?.focus();
      return Promise.resolve();
    }

    markScannerDetected();
    setBarcode("");
    scanQueueRef.current = scanQueueRef.current.then(async () => {
      try {
        const response = await api.get(`/products/barcode/${encodeURIComponent(code)}`);
        const product = response.data;
        if (
          !product ||
          String(product.barcode) !== code ||
          !Number.isFinite(Number(product.id)) ||
          !Number.isFinite(Number(product.sellingPrice)) ||
          !Number.isFinite(Number(product.stock))
        ) {
          console.error("Invalid product returned by barcode lookup:", response.data);
          toast.error("The product lookup returned invalid product data.");
          return;
        }
        addToCart(product);
      } catch (error) {
        console.error("Barcode product lookup failed:", error);
        if (error.response?.status === 404) {
          toast.error(error.response.data?.message || `Product not found for barcode: ${code}`);
        } else {
          toast.error(error.response?.data?.message || `Could not look up barcode: ${code}`);
        }
      }
    });
    return scanQueueRef.current;
  };

  const addCustomer = async () => {
    const name = newCustomerName.trim();
    const phone = newCustomerPhone.trim();

    if (!name) {
      toast.warning("Enter the customer's name.");
      return;
    }

    if (!/^[\p{L}\p{M}\s'-]+$/u.test(name)) {
      toast.warning("Name can only contain letters, spaces, apostrophes, and hyphens.");
      return;
    }

    if (phone && !/^\d{10}$/.test(phone)) {
      toast.warning("Phone number must contain exactly 10 digits.");
      return;
    }

    try {
      setSavingCustomer(true);
      const response = await api.post("/customers", { name, phone });
      const customer = response.data;

      setCustomers((currentCustomers) => [
        customer,
        ...currentCustomers.filter((item) => item.id !== customer.id),
      ]);
      setSelectedCustomer(String(customer.id));
      setNewCustomerName("");
      setNewCustomerPhone("");
      setShowAddCustomer(false);
      toast.success(
        customer.alreadyExists
          ? "Existing customer selected for this sale."
          : "Customer added and selected for this sale."
      );
    } catch (error) {
      console.error("Add customer from billing failed:", error);
      toast.error(error.response?.data?.message || "Failed to add customer.");
    } finally {
      setSavingCustomer(false);
    }
  };

  const matchingCustomers = newCustomerName.trim()
    ? customers
        .filter((customer) => customer.name.toLowerCase().includes(newCustomerName.trim().toLowerCase()))
        .slice(0, 5)
    : [];

  const selectExistingCustomer = (customer) => {
    setSelectedCustomer(String(customer.id));
    setNewCustomerName("");
    setNewCustomerPhone("");
    setShowAddCustomer(false);
    toast.success("Existing customer selected for this sale.");
  };






  // Quantity

  const increaseQty=(id)=>{


    const item = cartRef.current.find((cartItem) => cartItem.id === id);
    if (item) addToCart(item);


  };





  const decreaseQty=(id)=>{


    setCurrentCart((current) => current
      .map((item) => item.id === id ? { ...item, qty: item.qty - 1 } : item)
      .filter((item) => item.qty > 0));


  };







  // Total

  const subtotal = cart.reduce(

    (sum,item)=>

      sum +
      item.qty *
      Number(item.sellingPrice),

    0

  );

  const amounts = calculatePOSAmounts(subtotal, posSettings);
  const total = amounts.total;






  // Complete Sale

  const completeSale = async()=>{

    const cashierPreferences = getCashierPreferences();

    if (!billingSettingsLoaded) {
      toast.error("Billing settings are unavailable. Reload the page before completing a sale.");
      return;
    }

    if(cart.length===0){

      toast.warning(
        "Cart is empty"
      );

      return;

    }

    if (
      cashierPreferences.confirmSale &&
      !window.confirm("Complete this sale?")
    ) {
      return;
    }





    if(
      paymentMethod==="Cash"
      &&
      Number(cashReceived)<total
    ){

      toast.warning(
        "Cash received is less than total"
      );

      return;

    }





    let receiptWindow = null;

    try {
      receiptWindow = window.open(
        "",
        "smartpos-thermal-receipt",
        "popup,width=360,height=720"
      );

      const response = await api.post("/sales", {

        cart,

        total,

        paymentMethod,

        cashReceived:
          Number(cashReceived),


        customerId:
          selectedCustomer 
           ? Number(selectedCustomer)
           : null


      });

      const sale = response.data?.sale;
      if (receiptWindow && sale) {
        try {
          const currentUser = JSON.parse(sessionStorage.getItem("user") || "null");
          const receiptMarkup = getThermalReceiptMarkup(sale, {
            business: businessSettings,
            posSettings,
            receiptSettings,
            cashierName: currentUser?.name || "",
          });
          const receiptSize = receiptSettings.receiptSize || "80mm";
          receiptWindow.document.open();
          receiptWindow.document.write(`<!doctype html>
            <html>
              <head>
                <title>SmartPOS Receipt</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                  ${getReceiptPrintStyles(receiptSize)}
                </style>
              </head>
              <body>${receiptMarkup}</body>
            </html>`);
          receiptWindow.document.close();
          receiptWindow.focus();
          receiptWindow.onafterprint = () => receiptWindow.close();
          receiptWindow.setTimeout(() => receiptWindow.print(), 400);
        } catch (printError) {
          console.error("Failed to prepare thermal receipt:", printError);
          receiptWindow.close();
          receiptWindow = null;
        }
      } else if (receiptWindow) {
        receiptWindow.close();
        receiptWindow = null;
      }

      toast.success("Sale completed successfully");

      setCurrentCart([]);

      setCashReceived("");

      setPaymentMethod(getCashierPreferences().defaultPaymentMethod);

      setSelectedCustomer("");

      loadProducts();

      if (!receiptWindow) {
        toast.warning("Sale saved. Allow pop-ups to print the thermal receipt.");
      }
    } catch(error) {
      if (receiptWindow && !receiptWindow.closed) {
        receiptWindow.close();
      }
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to complete sale");
    }


  };







  return (

    <div className={`billing-page${isCashier ? " cashier-billing" : ""}`}>
      <header className="billing-header">
        <div>
          <PageTitle icon={<AppIcon name="cart" />} className="page-title-compact">New sale</PageTitle>
          <p className="billing-subtitle">Find products, build the order, and check out.</p>
        </div>
        <div className="billing-header-actions">
          <button
            type="button"
            className="billing-held-bills-trigger"
            aria-expanded={showHeldBills}
            onClick={() => setShowHeldBills((visible) => !visible)}
          >
            <AppIcon name="clock" />
            Held bills
            {heldBills.length > 0 && <span>{heldBills.length}</span>}
          </button>
          <button
            type="button"
            className="billing-hold-button"
            disabled={cart.length === 0}
            onClick={() => holdCurrentBill()}
          >
            Hold &amp; New
          </button>
        {isCashier && (
          <button
            type="button"
            className="cashier-settings-trigger"
            aria-label="Cashier settings"
            title="Cashier settings"
            onClick={onOpenSettings}
          >
            <FaCog size={18} />
          </button>
        )}
        </div>
      </header>

      {showHeldBills && (
        <section className="billing-held-bills" aria-label="Held bills">
          <div className="billing-held-bills-heading">
            <div>
              <strong>Held bills</strong>
              <span>Continue a saved order or remove it.</span>
            </div>
            <button type="button" onClick={() => setShowHeldBills(false)} aria-label="Close held bills">
              ×
            </button>
          </div>
          {heldBills.length === 0 ? (
            <p className="billing-held-bills-empty">No bills are on hold.</p>
          ) : (
            <ul>
              {heldBills.map((heldBill, index) => {
                const customer = customers.find(
                  (item) => String(item.id) === String(heldBill.selectedCustomer)
                );
                const itemCount = heldBill.cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);
                return (
                  <li key={heldBill.id}>
                    <div className="billing-held-bill-info">
                      <strong>{customer?.name || "Walk-in customer"}</strong>
                      <span>
                        {itemCount} {itemCount === 1 ? "item" : "items"} ·{" "}
                        {new Date(heldBill.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="billing-held-bill-actions">
                      <button
                        type="button"
                        disabled={!productsLoaded}
                        onClick={() => continueHeldBill(heldBill)}
                      >
                        Continue
                      </button>
                      <button
                        type="button"
                        className="billing-held-bill-remove"
                        aria-label={`Remove held bill ${index + 1}`}
                        onClick={() => setHeldBills((current) => current.filter((item) => item.id !== heldBill.id))}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section className="billing-customer-bar">
        <div className="billing-customer-copy">
          <span className="billing-section-kicker">CUSTOMER</span>
          <span className="billing-customer-hint">Choose a customer for this sale</span>
        </div>
        <div className="billing-customer-actions">
          <select
            aria-label="Select customer"
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
          >
            <option value="">Walk-in customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} - {customer.phone}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="billing-new-customer-button"
            onClick={() => setShowAddCustomer((visible) => !visible)}
            aria-expanded={showAddCustomer}
          >
            <AppIcon name="user" />
            {showAddCustomer ? "Cancel" : "New customer"}
          </button>
        </div>
      </section>

      {showAddCustomer && (
        <div
          className="billing-new-customer-form"
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.target.id === "billing-new-customer-name") {
              event.preventDefault();
              if (matchingCustomers.length > 0) {
                selectExistingCustomer(matchingCustomers[0]);
              } else {
                void addCustomer();
              }
            }
          }}
        >
          <div className="billing-customer-name-field">
            <label htmlFor="billing-new-customer-name">Customer name</label>
            <input
              id="billing-new-customer-name"
              autoFocus
              type="text"
              value={newCustomerName}
              onChange={(event) => setNewCustomerName(event.target.value)}
              placeholder="e.g. Priya Sharma"
              maxLength={100}
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls="billing-customer-suggestions"
              aria-expanded={matchingCustomers.length > 0}
              required
            />
            {matchingCustomers.length > 0 && (
              <ul
                id="billing-customer-suggestions"
                className="billing-customer-suggestions"
                aria-label="Existing customers"
              >
                {matchingCustomers.map((customer) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectExistingCustomer(customer)}
                    >
                      <span>{customer.name}</span>
                      <small>{customer.phone}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label>
            Phone number
            <input
              type="tel"
              inputMode="numeric"
              value={newCustomerPhone}
              onChange={(event) => setNewCustomerPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit phone number (new customers)"
              maxLength={10}
            />
          </label>
          <button type="button" onClick={() => void addCustomer()} disabled={savingCustomer}>
            {savingCustomer ? "Saving..." : "Save & select customer"}
          </button>
        </div>
      )}

      <SearchBar
        search={search}
        setSearch={setSearch}
        barcode={barcode}
        setBarcode={setBarcode}
        scanBarcode={scanBarcode}
        barcodeInputRef={scannerInputRef}
        onBarcodeKeyDown={handleBarcodeKeyDown}
      />

      <div className="billing-workspace">
        <ProductList
          products={filteredProducts}
          addToCart={addToCart}
          currency={posSettings.currency}
          restoreBarcodeFocus={() => scannerInputRef.current?.focus()}
        />

        <aside className="billing-checkout">
          <Cart
            cart={cart}
            increaseQty={increaseQty}
            decreaseQty={decreaseQty}
            currency={posSettings.currency}
            scannerConnected={scannerConnected}
          />
          <Payment
            total={total}
            amounts={amounts}
            currency={posSettings.currency}
            settingsLoaded={billingSettingsLoaded}

            cashReceived={cashReceived}

            setCashReceived={setCashReceived}

            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            completeSale={completeSale}
          />
        </aside>
      </div>
    </div>

  );

}



export default Billing;