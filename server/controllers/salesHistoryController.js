const prisma = require("../prisma/client");


// Get all sales history
exports.getSalesHistory = async (req, res) => {

  try {

    const sales = await prisma.sale.findMany({
      where: {
        merchantId: req.user.merchantId,
        paymentStatus: "PAID",
      },

      orderBy: {
        createdAt: "desc"
      },


      include: {

        // Sale products
        items: {

          include: {

            product: true

          }

        },


        // Customer details
        customer: true,
        returns: {
          orderBy: { createdAt: "desc" },
          include: {
            items: {
              include: {
                saleItem: { include: { product: true } },
              },
            },
            exchangeItems: { include: { product: true } },
            processedBy: { select: { id: true, name: true } },
          },
        }

      }

    });



    res.json(sales);


  } catch (error) {

    console.error(error);


    res.status(500).json({

      message: "Failed to fetch sales history"

    });

  }

};