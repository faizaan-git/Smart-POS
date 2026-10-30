const prisma = require("../prisma/client");
const { notifyCustomerCreated } = require("../services/notificationService");


// Add Customer
exports.addCustomer = async (req, res) => {

  try {

    const { name, phone } = req.body;
    const trimmedName = typeof name === "string" ? name.trim() : "";
    const normalizedPhone = typeof phone === "string" ? phone.trim() : "";

    if (!trimmedName) {
      return res.status(400).json({
        message: "Name is required",
      });
    }

    if (!/^[\p{L}\p{M}\s'-]+$/u.test(trimmedName)) {
      return res.status(400).json({
        message: "Name can only contain letters, spaces, apostrophes, and hyphens",
      });
    }

    const existingCustomer = await prisma.customer.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: "insensitive",
        },
      },
    });

    if (existingCustomer) {
      return res.status(200).json({
        ...existingCustomer,
        alreadyExists: true,
        message: `A customer named "${existingCustomer.name}" already exists`,
      });
    }

    if (!normalizedPhone) {
      return res.status(400).json({
        message: "Phone is required for a new customer",
      });
    }

    if (!/^\d{10}$/.test(normalizedPhone)) {
      return res.status(400).json({
        message: "Phone number must contain exactly 10 digits",
      });
    }

    const customer = await prisma.customer.create({

      data: {
        name: trimmedName,
        phone: normalizedPhone
      }

    });

    await notifyCustomerCreated(prisma, customer);

    res.status(201).json(customer);


  } catch(error) {

    console.error(error);

    if (error.code === "P2002") {
      return res.status(409).json({
        message: "A customer with this phone number already exists",
      });
    }

    res.status(500).json({
      message:"Failed to add customer"
    });

  }

};



// Get Customers
exports.getCustomers = async (req,res)=>{

  try {

    const customers =
      await prisma.customer.findMany({

        orderBy:{
          createdAt:"desc"
        }

      });


    res.json(customers);


  } catch(error){

    console.error(error);

    res.status(500).json({
      message:"Failed to fetch customers"
    });

  }

};



// Search Customer
exports.searchCustomer = async(req,res)=>{

  try {

    const { search } = req.query;


    const customers =
      await prisma.customer.findMany({

        where:{
          OR:[
            {
              name:{
                contains:search,
                mode:"insensitive"
              }
            },
            {
              phone:{
                contains:search
              }
            }
          ]
        }

      });


    res.json(customers);


  } catch(error){

    console.error(error);

    res.status(500).json({
      message:"Search failed"
    });

  }

};