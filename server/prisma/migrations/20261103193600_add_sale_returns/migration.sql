CREATE TABLE "SaleReturn" (
    "id" SERIAL NOT NULL,
    "saleId" INTEGER NOT NULL,
    "merchantId" INTEGER NOT NULL,
    "processedById" INTEGER NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaleReturnItem" (
    "id" SERIAL NOT NULL,
    "returnId" INTEGER NOT NULL,
    "saleItemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "refundAmount" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "SaleReturnItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SaleReturn_saleId_createdAt_idx"
ON "SaleReturn"("saleId", "createdAt");
CREATE INDEX "SaleReturn_merchantId_createdAt_idx"
ON "SaleReturn"("merchantId", "createdAt");
CREATE UNIQUE INDEX "SaleReturnItem_returnId_saleItemId_key"
ON "SaleReturnItem"("returnId", "saleItemId");

ALTER TABLE "SaleReturn"
ADD CONSTRAINT "SaleReturn_saleId_merchantId_fkey"
FOREIGN KEY ("saleId", "merchantId") REFERENCES "Sale"("id", "merchantId")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleReturn"
ADD CONSTRAINT "SaleReturn_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleReturn"
ADD CONSTRAINT "SaleReturn_processedById_merchantId_fkey"
FOREIGN KEY ("processedById", "merchantId") REFERENCES "User"("id", "merchantId")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleReturnItem"
ADD CONSTRAINT "SaleReturnItem_returnId_fkey"
FOREIGN KEY ("returnId") REFERENCES "SaleReturn"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleReturnItem"
ADD CONSTRAINT "SaleReturnItem_saleItemId_fkey"
FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
