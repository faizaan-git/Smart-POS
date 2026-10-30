import { toast } from "react-toastify";
import { useEffect, useState } from "react";
import api from "../services/api";
import PageTitle from "../components/PageTitle";
import AppIcon from "../components/AppIcon";
import CameraBarcodeScanner from "../components/CameraBarcodeScanner";
import "./styles/Products.css";

function Products() {
  const [products, setProducts] = useState([]);

  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stock, setStock] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [barcodeLookup, setBarcodeLookup] = useState(false);

  const loadProducts = async () => {
    try {
      const res = await api.get("/products");
      setProducts(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load products");
    }
  };

  useEffect(() => {
    let active = true;

    const loadInitialProducts = async () => {
      try {
        const response = await api.get("/products");
        if (active) setProducts(response.data);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load products");
      }
    };

    void loadInitialProducts();
    return () => {
      active = false;
    };
  }, []);

  const clearForm = () => {
    setEditingId(null);
    setName("");
    setBarcode("");
    setCategory("");
    setPurchasePrice("");
    setSellingPrice("");
    setStock("");
  };

  const handleBarcodeScan = async (value) => {
    const scannedBarcode = value.trim();
    if (!/^[A-Za-z0-9\-_]+$/.test(scannedBarcode)) {
      toast.error("Scanned barcode contains unsupported characters.");
      return;
    }

    setCameraOpen(false);

    const existingProduct = products.find((product) => product.barcode === scannedBarcode);
    if (existingProduct) {
      editProduct(existingProduct);
      toast.info("This barcode already exists. Its product details have been loaded.");
      return;
    }

    clearForm();
    setBarcode(scannedBarcode);

    if (!/^\d{8,14}$/.test(scannedBarcode)) {
      setName("");
      setCategory("Uncategorized");
      toast.error("This barcode format cannot be looked up in the product catalog. Enter the product name and category manually.");
      return;
    }

    setBarcodeLookup(true);
    try {
      const response = await api.get(`/products/catalog/${encodeURIComponent(scannedBarcode)}`);
      setName(response.data.name);
      setCategory(response.data.category || "Uncategorized");
      toast.success("Product name and category found. Enter your prices and stock, then add the product.");
    } catch (error) {
      console.error("Scanned product catalog lookup failed:", error);
      setName("");
      setCategory("Uncategorized");
      toast.error(
        error.response?.data?.message
          || "Could not find this barcode in the product catalog. Enter the product name and category manually."
      );
    } finally {
      setBarcodeLookup(false);
    }
  };

  const validateProduct = () => {
    const trimmedName = name.trim();
    const trimmedBarcode = barcode.trim();
    const trimmedCategory = category.trim();
    const purchase = Number(purchasePrice);
    const selling = Number(sellingPrice);
    const qty = Number(stock);

    if (!trimmedName) {
      toast.error("Product name is required.");
      return false;
    }

    if (!trimmedBarcode) {
      toast.error("Barcode is required.");
      return false;
    }

    if (!trimmedCategory) {
      toast.error("Category is required.");
      return false;
    }

    if (!purchasePrice || Number.isNaN(purchase) || purchase <= 0) {
      toast.error("Purchase price must be a valid number greater than 0.");
      return false;
    }

    if (!sellingPrice || Number.isNaN(selling) || selling <= 0) {
      toast.error("Selling price must be a valid number greater than 0.");
      return false;
    }

    if (!stock || Number.isNaN(qty) || qty < 0) {
      toast.error("Stock must be a valid number and cannot be negative.");
      return false;
    }

    if (!/^[A-Za-z0-9\-_]+$/.test(trimmedBarcode)) {
      toast.error("Barcode can only contain letters, numbers, hyphen, and underscore.");
      return false;
    }

    return true;
  };

  const addProduct = async () => {
    if (!validateProduct()) return;

    try {
      await api.post("/products", {
        name: name.trim(),
        barcode: barcode.trim(),
        category: category.trim(),
        purchasePrice: Number(purchasePrice),
        sellingPrice: Number(sellingPrice),
        stock: Number(stock),
      });

      toast.success("Product added successfully!");
      clearForm();
      loadProducts();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add product!");
    }
  };

  const editProduct = (product) => {
    setEditingId(product.id);
    setName(product.name);
    setBarcode(product.barcode);
    setCategory(product.category);
    setPurchasePrice(product.purchasePrice);
    setSellingPrice(product.sellingPrice);
    setStock(product.stock);
  };

  const updateProduct = async () => {
    if (!validateProduct()) return;

    try {
      await api.put(`/products/${editingId}`, {
        name: name.trim(),
        barcode: barcode.trim(),
        category: category.trim(),
        purchasePrice: Number(purchasePrice),
        sellingPrice: Number(sellingPrice),
        stock: Number(stock),
      });

      toast.success("Product updated successfully!");
      clearForm();
      loadProducts();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update product");
    }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      await api.delete(`/products/${id}`);
      toast.success("Product deleted successfully!");
      loadProducts();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete product");
    }
  };

  return (
    <div className="admin-products-page" style={{ padding: "30px" }}>
      <PageTitle icon={<AppIcon name="box" />}>Product Management</PageTitle>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <input
          placeholder="Product Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="admin-products-barcode-field">
          <input
            aria-label="Barcode"
            placeholder="Barcode"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value.replace(/[^A-Za-z0-9\-_]/g, ""))}
          />
          <button
            type="button"
            className="admin-products-scan"
            disabled={barcodeLookup}
            onClick={() => setCameraOpen(true)}
          >
            <AppIcon name="camera" />
            Scan
          </button>
        </div>

        <input
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />

        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Purchase Price"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value.replace(/[^0-9.]/g, ""))}
        />

        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Selling Price"
          value={sellingPrice}
          onChange={(e) => setSellingPrice(e.target.value.replace(/[^0-9.]/g, ""))}
        />

        <input
          type="number"
          min="0"
          step="1"
          placeholder="Stock"
          value={stock}
          onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ""))}
        />
      </div>

      <div className="admin-products-actions">
        <button
          className={`admin-products-submit${editingId ? " is-editing" : ""}`}
          onClick={editingId ? updateProduct : addProduct}
        >
          {editingId ? "Update Product" : "Add Product"}
        </button>

        {editingId && (
          <button
            className="admin-products-cancel"
            onClick={clearForm}
          >
            Cancel
          </button>
        )}
      </div>
      {barcodeLookup && (
        <p className="admin-products-lookup-status" role="status">
          Looking up product details for barcode {barcode}...
        </p>
      )}

      {cameraOpen && (
        <CameraBarcodeScanner
          onDetected={handleBarcodeScan}
          onClose={() => setCameraOpen(false)}
        />
      )}

      <table
        className="admin-products-table"
        border="1"
        cellPadding="10"
        style={{
          width: "100%",
          borderCollapse: "collapse",
          background: "#fff",
        }}
      >
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Barcode</th>
            <th>Category</th>
            <th>Purchase Price</th>
            <th>Selling Price</th>
            <th>Stock</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {products.length > 0 ? (
            products.map((product) => (
              <tr key={product.id}>
                <td>{product.id}</td>
                <td>{product.name}</td>
                <td>{product.barcode}</td>
                <td>{product.category}</td>
                <td>₹{product.purchasePrice}</td>
                <td>₹{product.sellingPrice}</td>
                <td>{product.stock}</td>
                <td>
                  <div className="admin-product-row-actions">
                    <button
                      className="admin-product-edit"
                      onClick={() => editProduct(product)}
                    >
                      Edit
                    </button>

                    <button
                      className="admin-product-delete"
                      onClick={() => deleteProduct(product.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="8" style={{ textAlign: "center" }}>
                No Products Found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Products;