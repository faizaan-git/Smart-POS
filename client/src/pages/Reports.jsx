import { useEffect, useState, useCallback, useMemo } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import PageTitle from "../components/PageTitle";
import AppIcon from "../components/AppIcon";
import { subscribeToBusinessSettings } from "../services/businessSettingsEvents";
import "./styles/Reports.css";

function Reports() {
  const [sales, setSales] = useState([]);
  const [businessName, setBusinessName] = useState("");

  const [summary, setSummary] = useState({
    totalSales: 0,
    totalRevenue: 0,
  });

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let receivedSettingsUpdate = false;
    const unsubscribe = subscribeToBusinessSettings((settings) => {
      receivedSettingsUpdate = true;
      setBusinessName(settings?.businessName?.trim() || "");
    });

    api.get("/settings/business")
      .then((response) => {
        if (active && !receivedSettingsUpdate) {
          setBusinessName(response.data?.businessName?.trim() || "");
        }
      })
      .catch((error) => {
        console.error("Failed to load business name for report:", error);
        if (active) toast.error("Failed to load business name.");
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // =====================================================
  // DATE UTILS
  // =====================================================

  const formatDateInput = (date) => {
    if (!(date instanceof Date) || isNaN(date)) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // =====================================================
  // LOAD SALES REPORT
  // =====================================================

  const loadReport = useCallback(async (start = "", end = "") => {
    try {
      const params = new URLSearchParams();
      if (start) params.append("startDate", start);
      if (end) params.append("endDate", end);

      const query = params.toString();
      const url = query ? `/reports/sales?${query}` : "/reports/sales";
      const response = await api.get(url);
      setSales(response.data?.sales || []);
      setSummary(
        response.data?.summary || {
          totalSales: 0,
          totalRevenue: 0,
        }
      );
    } catch (error) {
      console.error("Sales Report Error:", error);
      toast.error("Failed to load sales report");
    } finally {
      setLoading(false);
    }
  }, []);

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    let active = true;

    const loadInitialReport = async () => {
      try {
        const response = await api.get("/reports/sales");
        if (active) {
          setSales(response.data?.sales || []);
          setSummary(
            response.data?.summary || {
              totalSales: 0,
              totalRevenue: 0,
            }
          );
        }
      } catch (error) {
        console.error("Sales Report Error:", error);
        toast.error("Failed to load sales report");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadInitialReport();
    return () => {
      active = false;
    };
  }, []);

  // =====================================================
  // HELPER TO SYNC STATE + FETCH
  // =====================================================

  const applyDateRange = (start, end) => {
    const startValue = formatDateInput(start);
    const endValue = formatDateInput(end);

    setStartDate(startValue);
    setEndDate(endValue);

    setLoading(true);
    loadReport(startValue, endValue);
  };

  // =====================================================
  // QUICK FILTERS
  // =====================================================

  const handleToday = () => {
    const today = new Date();
    applyDateRange(today, today);
  };

  const handleYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    applyDateRange(yesterday, yesterday);
  };

  const handleLast7Days = () => {
    const today = new Date();
    const start = new Date();

    start.setDate(start.getDate() - 6);

    applyDateRange(start, today);
  };

  const handleThisMonth = () => {
    const today = new Date();
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

    applyDateRange(start, today);
  };

  // =====================================================
  // CUSTOM FILTER
  // =====================================================

  const handleApplyFilter = () => {
    setLoading(true);
    loadReport(startDate, endDate);
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setLoading(true);
    loadReport("", "");
  };

  // =====================================================
  // FORMATTERS
  // =====================================================

  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (date) => {
    if (!date) return "-";

    const d = new Date(date);

    if (isNaN(d)) return "-";

    return d.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  // =====================================================
  // PAYMENT BADGE
  // =====================================================

  const getPaymentClass = (method) => {
    const payment = (method || "Cash").toLowerCase();

    if (payment === "upi") {
      return "payment-badge payment-upi";
    }

    if (payment === "card") {
      return "payment-badge payment-card";
    }

    return "payment-badge payment-cash";
  };

  // =====================================================
  // PAYMENT TOTALS
  // =====================================================

  const paymentTotals = useMemo(() => {
    return sales.reduce(
      (totals, sale) => {
        const method = (
          sale.paymentMethod || "Cash"
        ).toLowerCase();

        const amount = Number(sale.total || 0);

        switch (method) {
          case "upi":
            totals.upi += amount;
            break;

          case "card":
            totals.card += amount;
            break;

          default:
            totals.cash += amount;
        }

        return totals;
      },
      {
        cash: 0,
        upi: 0,
        card: 0,
      }
    );
  }, [sales]);
  const averageSale = Number(summary.totalSales)
    ? Number(summary.totalRevenue) / Number(summary.totalSales)
    : 0;

  // =====================================================
  // PRINT REPORT
  // =====================================================

  const printReport = () => {
    window.print();
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="reports-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="reports-header">
        <div className="reports-title">
          <span className="reports-eyebrow">BUSINESS INSIGHTS</span>
          <PageTitle icon={<AppIcon name="chartLine" />}>Sales Reports</PageTitle>
          <p>Track revenue, payment methods, and transaction activity.</p>
        </div>
      </div>


      {/* =================================================
          FILTER + PAYMENT SUMMARY
      ================================================= */}

      <div className="reports-top-section screen-only">

        {/* =================================================
            FILTER SALES
        ================================================= */}

        <section className="report-filters">

          <div className="filter-card-header">
            <div className="filter-heading">

              <div className="filter-heading-icon"><AppIcon name="calendar" /></div>

              <div>
                <h2>Filter Sales</h2>

                <p>
                  Select a date range to view sales
                </p>
              </div>
            </div>

            <button
              type="button"
              className="print-button screen-only"
              onClick={printReport}
            >
              <><AppIcon name="print" /> Print Report</>
            </button>
          </div>


          {/* QUICK FILTERS */}

          <div className="quick-filter-section">

            <span className="filter-label">
              Quick Filters
            </span>

            <div className="quick-filters">

              <button
                type="button"
                onClick={handleToday}
              >
                Today
              </button>

              <button
                type="button"
                onClick={handleYesterday}
              >
                Yesterday
              </button>

              <button
                type="button"
                onClick={handleLast7Days}
              >
                Last 7 Days
              </button>

              <button
                type="button"
                onClick={handleThisMonth}
              >
                This Month
              </button>

            </div>

          </div>


          {/* CUSTOM DATE RANGE */}

          <div className="custom-date-section">

            <span className="filter-label">
              Custom Date Range
            </span>

            <div className="date-filter">

              <div className="date-input">

                <label htmlFor="start-date">
                  Start Date
                </label>

                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) =>
                    setStartDate(e.target.value)
                  }
                />

              </div>


              <div className="date-separator">
                →
              </div>


              <div className="date-input">

                <label htmlFor="end-date">
                  End Date
                </label>

                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) =>
                    setEndDate(e.target.value)
                  }
                />

              </div>


              <button
                type="button"
                className="apply-button"
                onClick={handleApplyFilter}
                disabled={loading}
              >
                <><AppIcon name="search" /> Apply Filter</>
              </button>


              <button
                type="button"
                className="clear-button"
                onClick={clearFilters}
                disabled={loading}
              >
                Clear
              </button>

            </div>

          </div>

        </section>


        {/* =================================================
            RIGHT COLUMN
        ================================================= */}

        <div className="reports-right-column">

          {/* =================================================
              PAYMENT SUMMARY - BOTTOM
          ================================================= */}

          <section className="payment-summary">

            <div className="payment-summary-title">

              <h2>
                Payment Summary
              </h2>

              <p>
                Sales collected by payment method
              </p>

            </div>


            <div className="payment-summary-list">

              {[
                {
                  key: "cash",
                  label: "Cash",
                  icon: <AppIcon name="money" />,
                },
                {
                  key: "upi",
                  label: "UPI",
                  icon: <AppIcon name="mobile" />,
                },
                {
                  key: "card",
                  label: "Card",
                  icon: <AppIcon name="creditCard" />,
                },
              ].map(
                ({ key, label, icon }) => (

                  <div
                    className="payment-summary-row"
                    key={key}
                  >

                    <div
                      className={`payment-method payment-${key}`}
                    >

                      <span>
                        {icon}
                      </span>

                      <span>
                        {label}
                      </span>

                    </div>

                    <strong>
                      {formatCurrency(
                        paymentTotals[key]
                      )}
                    </strong>

                  </div>

                )
              )}

            </div>

          </section>

        </div>

      </div>


      {/* =================================================
          PRINTABLE REPORT
      ================================================= */}

      <section className="printable-report">

        {/* PRINT HEADER */}

        <div className="print-header">

          <h1>
            {businessName || "SmartPOS"}
          </h1>

          <h2>
            Sales Report
          </h2>

          <p>
            Generated on{" "}
            {new Date().toLocaleString("en-IN")}
          </p>

        </div>


        {/* =================================================
            SALES OVERVIEW
        ================================================= */}

        <div className="summary-section">

          <div className="section-heading">

            <div>

              <h2>
                Sales Overview
              </h2>

              <p>
                Summary of transactions and revenue
              </p>

            </div>

          </div>


          <div className="summary-grid">

            {/* TOTAL TRANSACTIONS */}

            <div className="summary-card">

              <div className="summary-content">

                <span className="summary-label">
                  Total Transactions
                </span>

                <strong className="summary-value">
                  {summary.totalSales}
                </strong>

              </div>

              <div className="summary-icon sales-icon">
                <AppIcon name="cart" />
              </div>

            </div>


            {/* TOTAL REVENUE */}

            <div className="summary-card">

              <div className="summary-content">

                <span className="summary-label">
                  Total Revenue
                </span>

                <strong className="summary-value revenue-value">
                  {formatCurrency(
                    summary.totalRevenue
                  )}
                </strong>

              </div>

              <div className="summary-icon revenue-icon">
                ₹
              </div>

            </div>

            <div className="summary-card">
              <div className="summary-content">
                <span className="summary-label">Average Sale</span>
                <strong className="summary-value">
                  {formatCurrency(averageSale)}
                </strong>
              </div>
              <div className="summary-icon average-icon">
                <AppIcon name="chartLine" />
              </div>
            </div>

          </div>

        </div>


        {/* =================================================
            SALES TRANSACTIONS
        ================================================= */}

        <div className="transactions-section">

          <div className="table-header">

            <div>

              <h2>
                Sales Transactions
              </h2>

              <p>
                {sales.length} transaction
                {sales.length !== 1 ? "s" : ""}
              </p>

            </div>

          </div>


          {/* LOADING */}

          {loading && (

            <div className="message">

              <div className="loading-icon">
                <AppIcon name="clock" />
              </div>

              <h3>
                Loading Report
              </h3>

              <p>
                Please wait while the sales data is loaded.
              </p>

            </div>

          )}


          {/* EMPTY */}

          {!loading && sales.length === 0 && (

            <div className="message">

              <div className="empty-icon">
                <AppIcon name="inbox" />
              </div>

              <h3>
                No Sales Found
              </h3>

              <p>
                No sales transactions were found for the selected period.
              </p>

            </div>

          )}


          {/* SALES TABLE */}

          {!loading && sales.length > 0 && (

            <div className="sales-table-wrapper">

              <table className="sales-table">

                <thead>

                  <tr>

                    <th>
                      Sale ID
                    </th>

                    <th>
                      Customer
                    </th>

                    <th>
                      Amount
                    </th>

                    <th>
                      Payment
                    </th>

                    <th>
                      Date & Time
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {sales.map((sale) => (

                    <tr key={sale.id}>

                      {/* SALE ID */}

                      <td>

                        <span className="sale-id">
                          #{sale.id}
                        </span>

                      </td>


                      {/* CUSTOMER */}

                      <td>

                        <div className="customer-cell">

                          <div className="customer-avatar">

                            {(
                              sale.customer?.name ||
                              "W"
                            )
                              .charAt(0)
                              .toUpperCase()}

                          </div>

                          <span>
                            {sale.customer?.name ||
                              "Walk-in Customer"}
                          </span>

                        </div>

                      </td>


                      {/* AMOUNT */}

                      <td>

                        <strong className="amount">
                          {formatCurrency(
                            sale.total
                          )}
                        </strong>

                      </td>


                      {/* PAYMENT */}

                      <td>

                        <span
                          className={getPaymentClass(
                            sale.paymentMethod
                          )}
                        >
                          {sale.paymentMethod ||
                            "Cash"}
                        </span>

                      </td>


                      {/* DATE */}

                      <td className="date-cell">

                        {formatDate(
                          sale.createdAt
                        )}

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </section>

    </div>
  );
}

export default Reports;