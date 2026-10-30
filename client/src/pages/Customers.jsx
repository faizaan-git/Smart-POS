import { useEffect, useState } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import PageTitle from "../components/PageTitle";
import AppIcon from "../components/AppIcon";
import "./styles/Customers.css";


function Customers() {


  const [customers, setCustomers] = useState([]);

  const [name, setName] = useState("");

  const [phone, setPhone] = useState("");

  const [search, setSearch] = useState("");



  const loadCustomers = async()=>{

    try{

      const res =
        await api.get("/customers");

      setCustomers(res.data);


    }catch(error){

      console.error(error);

      toast.error("Failed to load customers");

    }

  };

  useEffect(() => {
    let active = true;

    const loadInitialCustomers = async () => {
      try {
        const response = await api.get("/customers");
        if (active) setCustomers(response.data);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load customers");
      }
    };

    void loadInitialCustomers();
    return () => {
      active = false;
    };
  }, []);



  const addCustomer = async()=>{


    const trimmedName = name.trim();

    if(!trimmedName){

      toast.error(
        "Name is required"
      );

      return;

    }

    if (!/^[\p{L}\p{M}\s'-]+$/u.test(trimmedName)) {
      toast.error("Name can only contain letters.");
      return;
    }

    if (phone && !/^\d{10}$/.test(phone)) {
      toast.error("Phone number must contain exactly 10 digits.");
      return;
    }



    try{


      const response = await api.post("/customers",{

        name: trimmedName,

        phone

      });

      toast.success(response.data?.alreadyExists
        ? "Customer already exists"
        : "Customer added");


      setName("");

      setPhone("");

      loadCustomers();



    }catch(error){

      console.error(error);

      toast.error(
        error.response?.data?.message || "Failed to add customer"
      );

    }


  };




  const filteredCustomers =
    customers.filter((customer)=>{


      return (

        customer.name
        .toLowerCase()
        .includes(
          search.toLowerCase()
        )

        ||

        customer.phone.includes(search)

      );


    });




  return (

    <div
      className="admin-customers-page"
      style={{
        padding:"30px"
      }}
    >


      <PageTitle icon={<AppIcon name="users" />}>Customer Management</PageTitle>




      <div

        style={{

          display:"flex",

          gap:"10px",

          marginBottom:"20px"

        }}

      >


        <input
          type="text"
          maxLength={80}
          placeholder="Customer Name"

          value={name}

          onChange={
            (e)=>setName(e.target.value.replace(/[^\p{L}\p{M}\s'-]/gu, ""))
          }

        />



        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]{10}"
          maxLength={10}
          placeholder="Phone Number"

          value={phone}

          onChange={
            (e)=>setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
          }

        />



        <button

          onClick={addCustomer}

          style={{

            background:"#2563eb",

            color:"#fff",

            padding:"10px 20px",

            border:"none",

            borderRadius:"6px"

          }}

        >

          Add Customer

        </button>



      </div>





      <input

        placeholder="Search customer..."

        value={search}

        onChange={
          (e)=>setSearch(e.target.value)
        }

        style={{

          padding:"10px",

          width:"300px",

          marginBottom:"20px"

        }}

      />






      <table
        className="admin-customers-table"

        style={{

          width:"100%",

          borderCollapse:"collapse",

          background:"#fff"

        }}

      >


        <thead>

          <tr>

            <th>ID</th>

            <th>Name</th>

            <th>Phone</th>

            <th>Date</th>

          </tr>

        </thead>



        <tbody>


        {

          filteredCustomers.length === 0 ?

          (

            <tr>

              <td
                colSpan="4"
                align="center"
              >

                No Customers Found

              </td>

            </tr>

          )

          :

          (

            filteredCustomers.map(
              (customer)=>(


                <tr key={customer.id}>


                  <td>
                    {customer.id}
                  </td>


                  <td>
                    {customer.name}
                  </td>


                  <td>
                    {customer.phone}
                  </td>


                  <td>

                    {
                      new Date(
                        customer.createdAt
                      ).toLocaleDateString()
                    }

                  </td>


                </tr>


              )
            )

          )

        }


        </tbody>


      </table>


    </div>

  );

}


export default Customers;