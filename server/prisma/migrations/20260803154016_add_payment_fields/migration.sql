-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "cashReceived" DOUBLE PRECISION,
ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'Cash';
