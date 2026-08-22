-- Item 12: DISPUTED / REFUNDED lifecycle. SQLite stores enums as TEXT, so
-- the two new enum values need no DDL — only the deadline columns the cron
-- sweeps and dispute rules read.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "paidAt" DATETIME;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "deliveredAt" DATETIME;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "disputedAt" DATETIME;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "disputeExpiresAt" DATETIME;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "disputeResolvedAt" DATETIME;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "disputeReason" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "disputePhotos" JSONB;

-- CreateIndex
CREATE INDEX "Order_status_paidAt_idx" ON "Order"("status", "paidAt");

-- CreateIndex
CREATE INDEX "Order_status_disputeExpiresAt_idx" ON "Order"("status", "disputeExpiresAt");
