const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const products = [
  {
    name: 'Rice 5kg',
    barcode: 'RICE-001',
    category: 'Groceries',
    purchasePrice: 110,
    sellingPrice: 145,
    stock: 25,
  },
  {
    name: 'Wheat Flour 1kg',
    barcode: 'WHEAT-001',
    category: 'Groceries',
    purchasePrice: 40,
    sellingPrice: 58,
    stock: 30,
  },
  {
    name: 'Milk 1L',
    barcode: 'MILK-001',
    category: 'Dairy',
    purchasePrice: 52,
    sellingPrice: 68,
    stock: 18,
  },
  {
    name: 'Bread',
    barcode: 'BREAD-001',
    category: 'Bakery',
    purchasePrice: 30,
    sellingPrice: 45,
    stock: 22,
  },
  {
    name: 'Soap',
    barcode: 'SOAP-001',
    category: 'Household',
    purchasePrice: 25,
    sellingPrice: 38,
    stock: 35,
  },
  {
    name: 'Shampoo',
    barcode: 'SHAMPOO-001',
    category: 'Personal Care',
    purchasePrice: 70,
    sellingPrice: 95,
    stock: 20,
  },
  {
    name: 'Bananas',
    barcode: 'FRUIT-001',
    category: 'Fruits',
    purchasePrice: 35,
    sellingPrice: 52,
    stock: 40,
  },
  {
    name: 'Coca Cola 250ml',
    barcode: 'DRINK-001',
    category: 'Beverages',
    purchasePrice: 32,
    sellingPrice: 48,
    stock: 26,
  },
  {
    name: 'Laptop Stand',
    barcode: 'ELEC-001',
    category: 'Electronics',
    purchasePrice: 550,
    sellingPrice: 820,
    stock: 8,
  },
  {
    name: 'Pens Pack',
    barcode: 'STATIONERY-001',
    category: 'Stationery',
    purchasePrice: 18,
    sellingPrice: 29,
    stock: 50,
  },
];

async function main() {
  await prisma.product.deleteMany({});

  for (const product of products) {
    await prisma.product.create({ data: product });
  }

  console.log(`Inserted ${products.length} products`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
