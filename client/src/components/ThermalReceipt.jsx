import AppIcon from "./AppIcon";

function ThermalReceipt({ sale }) {

  if (!sale) return null;


  return (
    <div
      id="thermal-receipt"
      style={{
        width:"280px",
        padding:"15px",
        background:"#fff",
        fontFamily:"monospace",
        fontSize:"14px",
      }}
    >

      <h3 style={{textAlign:"center"}}>
        <><AppIcon name="store" /> SmartPOS</>
      </h3>

      <p style={{textAlign:"center"}}>
        Retail Store
      </p>

      <hr/>


      <p>
        Invoice: #{sale.id}
      </p>


      <p>
        Date:
        {" "}
        {new Date(
          sale.createdAt
        ).toLocaleString()}
      </p>


      <hr/>


      {
        sale.items?.map((item,index)=>(

          <div key={index}>

            <div>
              {item.product?.name || item.productName || "Product"}
            </div>

            <div>
              {item.quantity || item.qty} x ₹{Number(item.price || item.product?.sellingPrice || 0).toFixed(2)}
            </div>

            <br/>

          </div>

        ))
      }


      <hr/>


      <h3>
        Total ₹{Number(sale.total).toFixed(2)}
      </h3>


      <p>
        Payment:
        {" "}
        {sale.paymentMethod}
      </p>


      <hr/>


      <p style={{textAlign:"center"}}>
        Thank You!
      </p>


    </div>
  );
}


export default ThermalReceipt;