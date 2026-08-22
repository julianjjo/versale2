/*
  Warnings:

  - A unique constraint covering the columns `[userId,productId]` on the table `Review` will be added. If there are existing duplicate values, this will fail.

*/
-- Reconcile any pre-existing duplicate (userId, productId) Review rows before
-- enforcing uniqueness: keep only the newest review per buyer per listing and
-- delete the older ones (their helpful votes cascade away with them).
DELETE FROM "Review"
WHERE "id" NOT IN (
    SELECT "id"
    FROM (
        SELECT "id",
               ROW_NUMBER() OVER (
                   PARTITION BY "userId", "productId"
                   ORDER BY "createdAt" DESC, "id" DESC
               ) AS "rn"
        FROM "Review"
    )
    WHERE "rn" = 1
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_productId_key" ON "Review"("userId", "productId");
