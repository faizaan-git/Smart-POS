ALTER TABLE "SaleReturn"
ADD COLUMN "replacementTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "settlementAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "paymentMethod" TEXT;

UPDATE "SaleReturn"
SET "settlementAmount" = -"total";

CREATE TABLE "SaleExchangeItem" (
    "id" SERIAL NOT NULL,
    "returnId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "SaleExchangeItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SaleExchangeItem_returnId_idx"
ON "SaleExchangeItem"("returnId");

ALTER TABLE "SaleExchangeItem"
ADD CONSTRAINT "SaleExchangeItem_returnId_fkey"
FOREIGN KEY ("returnId") REFERENCES "SaleReturn"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SaleExchangeItem"
ADD CONSTRAINT "SaleExchangeItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
