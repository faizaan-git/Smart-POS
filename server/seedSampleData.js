const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedCustomers() {
  const customers = [
    { name: 'Ayesha Khan', phone: '9876543210' },
    { name: 'Rahul Mehta', phone: '9123456780' },
    { name: 'Sofia Ali', phone: '9988776655' },
    { name: 'Vikram Singh', phone: '9345678901' },
    { name: 'Neha Sharma', phone: '9765432109' },
  ];

  await prisma.customer.deleteMany({});

  for (const customer of customers) {
    await prisma.customer.create({ data: customer });
  }

  console.log(`Inserted ${customers.length} customers`);
}

async function seedBusinessSettings() {
  const existing = await prisma.businessSettings.findFirst();

  if (!existing) {
    await prisma.businessSettings.create({
      data: {
        businessName: 'RetailSync POS',
        ownerName: 'Faizan Ahmed',
        phone: '+91 98765 43210',
        email: 'support@retailsync.com',
        address: '123 Market Road, Hyderabad',
        gstNumber: '29ABCDE1234F1Z5',
      },
    });
    console.log('Inserted business settings');
  } else {
    console.log('Business settings already exist');
  }
}

async function seedPOSSettings() {
  const existing = await prisma.pOSSettings.findFirst();

  if (!existing) {
    await prisma.pOSSettings.create({
      data: {
        enableTax: true,
        defaultTaxRate: 18,
        enableDiscount: true,
        defaultDiscount: 0,
        invoicePrefix: 'INV-',
        startingInvoiceNo: 1001,
        currency: 'INR',
        allowNegativeStock: false,
        requireCustomer: false,
      },
    });
    console.log('Inserted POS settings');
  } else {
    console.log('POS settings already exist');
  }
}

async function seedReceiptSettings() {
  const existing = await prisma.receiptSettings.findFirst();

  if (!existing) {
    await prisma.receiptSettings.create({
      data: {
        showBusinessName: true,
        showGSTNumber: true,
        showCustomerDetails: true,
        showCashierName: true,
        showTaxBreakdown: true,
        showDiscount: true,
        receiptSize: '80mm',
        footerMessage: 'Thank you for shopping with us!',
      },
    });
    console.log('Inserted receipt settings');
  } else {
    console.log('Receipt settings already exist');
  }
}

async function main() {
  await seedCustomers();
  await seedBusinessSettings();
  await seedPOSSettings();
  await seedReceiptSettings();
}

main()
  .catch((e) => {
    console.error('Sample data seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
