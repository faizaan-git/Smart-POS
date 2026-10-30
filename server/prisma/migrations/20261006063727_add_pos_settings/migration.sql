-- CreateTable
CREATE TABLE "POSSettings" (
    "id" SERIAL NOT NULL,
    "enableTax" BOOLEAN NOT NULL DEFAULT true,
    "defaultTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "enableDiscount" BOOLEAN NOT NULL DEFAULT true,
    "defaultDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV-',
    "startingInvoiceNo" INTEGER NOT NULL DEFAULT 1001,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "requireCustomer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "POSSettings_pkey" PRIMARY KEY ("id")
);
