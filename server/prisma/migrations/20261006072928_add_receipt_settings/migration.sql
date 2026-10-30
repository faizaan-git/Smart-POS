-- CreateTable
CREATE TABLE "ReceiptSettings" (
    "id" SERIAL NOT NULL,
    "showBusinessName" BOOLEAN NOT NULL DEFAULT true,
    "showGSTNumber" BOOLEAN NOT NULL DEFAULT true,
    "showCustomerDetails" BOOLEAN NOT NULL DEFAULT true,
    "showCashierName" BOOLEAN NOT NULL DEFAULT true,
    "showTaxBreakdown" BOOLEAN NOT NULL DEFAULT true,
    "showDiscount" BOOLEAN NOT NULL DEFAULT true,
    "receiptSize" TEXT NOT NULL DEFAULT '80mm',
    "footerMessage" TEXT NOT NULL DEFAULT 'Thank you for shopping with us!',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptSettings_pkey" PRIMARY KEY ("id")
);
