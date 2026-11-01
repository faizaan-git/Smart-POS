CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED');
CREATE TYPE "PaymentMethod" AS ENUM ('UPI');
CREATE TYPE "SalePaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');
CREATE TYPE "PaymentVerificationAction" AS ENUM ('UTR_SUBMITTED', 'APPROVED', 'REJECTED');

CREATE TABLE "Merchant" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Merchant" ("name", "updatedAt")
SELECT COALESCE(NULLIF(bs."businessName", ''), 'SmartPOS'), CURRENT_TIMESTAMP
FROM (SELECT 1) AS initial_store
LEFT JOIN (
    SELECT "businessName"
    FROM "BusinessSettings"
    ORDER BY "id"
    LIMIT 1
) AS bs ON TRUE;

ALTER TABLE "User" ADD COLUMN "merchantId" INTEGER;
ALTER TABLE "Sale" ADD COLUMN "merchantId" INTEGER;
ALTER TABLE "Sale" ADD COLUMN "paymentStatus" "SalePaymentStatus" NOT NULL DEFAULT 'PAID';

UPDATE "User"
SET "merchantId" = (SELECT "id" FROM "Merchant" ORDER BY "id" LIMIT 1);
UPDATE "Sale"
SET "merchantId" = (SELECT "id" FROM "Merchant" ORDER BY "id" LIMIT 1);

ALTER TABLE "User" ALTER COLUMN "merchantId" SET NOT NULL;
ALTER TABLE "Sale" ALTER COLUMN "merchantId" SET NOT NULL;

ALTER TABLE "User"
ADD CONSTRAINT "User_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "User_id_merchantId_key" ON "User"("id", "merchantId");

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Sale_merchantId_createdAt_idx" ON "Sale"("merchantId", "createdAt");
CREATE INDEX "Sale_merchantId_paymentStatus_idx" ON "Sale"("merchantId", "paymentStatus");
CREATE UNIQUE INDEX "Sale_id_merchantId_key" ON "Sale"("id", "merchantId");

CREATE TABLE "MerchantPaymentSettings" (
    "id" SERIAL NOT NULL,
    "merchantId" INTEGER NOT NULL,
    "businessName" TEXT NOT NULL,
    "upiId" TEXT NOT NULL,
    "upiDisplayName" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "paymentInstructions" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "qrExpirationMinutes" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantPaymentSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantPaymentSettings_merchantId_key"
ON "MerchantPaymentSettings"("merchantId");
ALTER TABLE "MerchantPaymentSettings"
ADD CONSTRAINT "MerchantPaymentSettings_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "merchantId" INTEGER NOT NULL,
    "saleId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'UPI',
    "transactionReference" TEXT NOT NULL,
    "paymentUri" TEXT NOT NULL,
    "merchantUpiId" TEXT NOT NULL,
    "merchantBusinessName" TEXT NOT NULL,
    "merchantDisplayName" TEXT NOT NULL,
    "paymentInstructions" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "utrNumber" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAmount" DECIMAL(12,2),
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_transactionReference_key"
ON "Payment"("transactionReference");
CREATE UNIQUE INDEX "Payment_id_merchantId_key" ON "Payment"("id", "merchantId");
CREATE UNIQUE INDEX "Payment_idempotencyKey_key"
ON "Payment"("idempotencyKey");
CREATE INDEX "Payment_merchantId_status_createdAt_idx"
ON "Payment"("merchantId", "status", "createdAt");
CREATE INDEX "Payment_merchantId_saleId_idx"
ON "Payment"("merchantId", "saleId");
CREATE INDEX "Payment_merchantId_utrNumber_idx"
ON "Payment"("merchantId", "utrNumber");
CREATE UNIQUE INDEX "Payment_successful_utr_per_merchant_key"
ON "Payment"("merchantId", "utrNumber")
WHERE "status" = 'SUCCESS' AND "utrNumber" IS NOT NULL;
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_saleId_merchantId_fkey"
FOREIGN KEY ("saleId", "merchantId") REFERENCES "Sale"("id", "merchantId")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_verifiedBy_fkey"
FOREIGN KEY ("verifiedBy", "merchantId") REFERENCES "User"("id", "merchantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PaymentVerificationLog" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "merchantId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "action" "PaymentVerificationAction" NOT NULL,
    "utrNumber" TEXT,
    "amount" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentVerificationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentVerificationLog_paymentId_createdAt_idx"
ON "PaymentVerificationLog"("paymentId", "createdAt");
CREATE INDEX "PaymentVerificationLog_actorId_createdAt_idx"
ON "PaymentVerificationLog"("actorId", "createdAt");
ALTER TABLE "PaymentVerificationLog"
ADD CONSTRAINT "PaymentVerificationLog_paymentId_merchantId_fkey"
FOREIGN KEY ("paymentId", "merchantId") REFERENCES "Payment"("id", "merchantId")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentVerificationLog"
ADD CONSTRAINT "PaymentVerificationLog_actorId_merchantId_fkey"
FOREIGN KEY ("actorId", "merchantId") REFERENCES "User"("id", "merchantId")
ON DELETE RESTRICT ON UPDATE CASCADE;
