-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProductReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductReport_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProductReport" ("createdAt", "id", "productId", "reason", "reporterId", "updatedAt") SELECT "createdAt", "id", "productId", "reason", "reporterId", "updatedAt" FROM "ProductReport";
DROP TABLE "ProductReport";
ALTER TABLE "new_ProductReport" RENAME TO "ProductReport";
CREATE INDEX "ProductReport_createdAt_idx" ON "ProductReport"("createdAt");
CREATE INDEX "ProductReport_status_updatedAt_idx" ON "ProductReport"("status", "updatedAt");
CREATE UNIQUE INDEX "ProductReport_productId_reporterId_key" ON "ProductReport"("productId", "reporterId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
