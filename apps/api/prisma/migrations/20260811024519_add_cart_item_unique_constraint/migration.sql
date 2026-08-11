/*
  Warnings:

  - A unique constraint covering the columns `[cartId,productId]` on the table `CartItem` will be added. If there are existing duplicate values, this will fail.

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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "images" JSONB,
    CONSTRAINT "Product_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("brand", "category", "condition", "createdAt", "description", "id", "images", "isApproved", "price", "sellerId", "size", "title", "updatedAt") SELECT "brand", "category", "condition", "createdAt", "description", "id", "images", "isApproved", "price", "sellerId", "size", "title", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Reconcile any pre-existing duplicate (cartId, productId) CartItem rows
-- before enforcing uniqueness: merge quantities into the earliest row.
UPDATE "CartItem"
SET "quantity" = (
    SELECT SUM("dup"."quantity")
    FROM "CartItem" AS "dup"
    WHERE "dup"."cartId" = "CartItem"."cartId"
      AND "dup"."productId" = "CartItem"."productId"
)
WHERE "id" IN (
    SELECT MIN("id")
    FROM "CartItem"
    GROUP BY "cartId", "productId"
);

DELETE FROM "CartItem"
WHERE "id" NOT IN (
    SELECT MIN("id")
    FROM "CartItem"
    GROUP BY "cartId", "productId"
);

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "CartItem"("cartId", "productId");
