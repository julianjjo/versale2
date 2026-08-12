-- AlterTable
ALTER TABLE "Product" ADD COLUMN "rejectedAt" DATETIME;
ALTER TABLE "Product" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "Product" ADD COLUMN "soldAt" DATETIME;
