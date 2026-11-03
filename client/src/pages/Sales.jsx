import { lazy, Suspense, useEffect, useState } from "react";
import api from "../services/api";
import { toast } from "react-toastify";

import PageTitle from "../components/PageTitle";
import AppIcon from "../components/AppIcon";
import "./styles/Sales.css";

const InvoiceModal = lazy(() => import("../components/InvoiceModal"));


function Sales() {

  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);


  useEffect(() => {
    let active = true;

    const loadInitialSales = async () => {
      try {
        const response = await api.get("/sales-history");
        if (active) setSales(response.data);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load sales");
      }
    };

    void loadInitialSales();
    return () => {
      active = false;
    };
  }, []);



  const filteredSales = sales.filter((sale) => {
    const query = search.trim().toLowerCase();
    return sale.id.toString().includes(query) ||
      sale.invoiceNumber?.toLowerCase().includes(query);
  });

  return (

    <div className="admin-sales-page">

      <PageTitle icon={<AppIcon name="invoice" />}>Sales History</PageTitle>


      <input
        type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label="Search invoice number or sale ID"

        placeholder="Search invoice number or sale ID..."

        value={search}

        onChange={(e)=>setSearch(e.target.value)}

        style={{
          padding:"12px",
          width:"300px",
          marginBottom:"20px",
          borderRadius:"8px",
          border:"1px solid #ddd"
        }}

      />



      <div

        style={{
          background:"#fff",
          padding:"20px",
          borderRadius:"12px",
          boxShadow:"0 3px 10px rgba(0,0,0,.1)"
        }}

      >

        <table
          className="admin-sales-history-table"

          style={{
            width:"100%",
            borderCollapse:"collapse"
          }}

        >

          <thead>

            <tr>

              <th>ID</th>

              <th>Total</th>

              <th>Payment</th>

              <th>Date</th>

              <th>Action</th>

            </tr>

          </thead>



          <tbody>


          {
            filteredSales.length === 0 ?

            (

              <tr>

                <td 
                  colSpan="5"
                  align="center"
                >
                  No Sales Found
                </td>

              </tr>

            )

            :

            (

              filteredSales.map((sale)=>(
                <tr key={sale.id}>

                  <td>
                    #{sale.id}
                  </td>


                  <td>
                    ₹{sale.total}
                  </td>


                  <td>
                    {sale.paymentMethod || "Cash"}
                  </td>


                  <td>
                    {
                      new Date(
                        sale.createdAt
                      ).toLocaleString()
                    }
                  </td>


                  <td>
                    <button

                      onClick={() =>
                        setSelectedSale(sale)
                      }

                      style={{
                        padding:"8px 15px",
                        background:"#2563eb",
                        color:"#fff",
                        border:"none",
                        borderRadius:"6px",
                        cursor:"pointer"
                      }}

                    >

                      View
                    </button>


                  </td>


                </tr>

              ))

            )
          }


          </tbody>


        </table>


      </div>



      {
        selectedSale && (
          <Suspense fallback={<div role="status">Loading invoice...</div>}>
            <InvoiceModal
              sale={selectedSale}
              close={() => setSelectedSale(null)}
            />
          </Suspense>
        )
      }

    </div>

  );

}

export default Sales;