/*
  Warnings:

  - The column `soldAt` on the `Product` table is dropped, but its data is
    preserved: the INSERT..SELECT below backfills `status` from it
    (soldAt IS NOT NULL => 'SOLD', otherwise 'AVAILABLE').

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT,
    "size" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "sellerId" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "rejectedAt" DATETIME,
    "rejectionReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "pausedAt" DATETIME,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "images" JSONB,
    CONSTRAINT "Product_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Backfill: carry every already-sold garment over to the new stock enum.
-- `WITHDRAWN` is never written yet (reserved for roadmap 1.3), so the only
-- two possible outcomes are AVAILABLE and SOLD.
INSERT INTO "new_Product" ("brand", "category", "condition", "createdAt", "description", "id", "images", "isApproved", "pausedAt", "price", "rejectedAt", "rejectionReason", "sellerId", "size", "status", "title", "updatedAt", "viewCount") SELECT "brand", "category", "condition", "createdAt", "description", "id", "images", "isApproved", "pausedAt", "price", "rejectedAt", "rejectionReason", "sellerId", "size", CASE WHEN "soldAt" IS NOT NULL THEN 'SOLD' ELSE 'AVAILABLE' END, "title", "updatedAt", "viewCount" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE INDEX "Product_isApproved_status_pausedAt_createdAt_idx" ON "Product"("isApproved", "status", "pausedAt", "createdAt");
CREATE INDEX "Product_isApproved_status_pausedAt_price_idx" ON "Product"("isApproved", "status", "pausedAt", "price");
CREATE INDEX "Product_isApproved_rejectedAt_idx" ON "Product"("isApproved", "rejectedAt");
CREATE INDEX "Product_sellerId_idx" ON "Product"("sellerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
