-- DropIndex
DROP INDEX "Product_isApproved_soldAt_price_idx";

-- DropIndex
DROP INDEX "Product_isApproved_soldAt_createdAt_idx";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "pausedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Product_isApproved_soldAt_pausedAt_createdAt_idx" ON "Product"("isApproved", "soldAt", "pausedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Product_isApproved_soldAt_pausedAt_price_idx" ON "Product"("isApproved", "soldAt", "pausedAt", "price");
