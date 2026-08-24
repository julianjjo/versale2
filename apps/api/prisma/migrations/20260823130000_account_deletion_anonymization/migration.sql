-- Borrado de cuenta con anonimización.
-- SQLite stores enums/JSON as TEXT; nullable DATETIME columns need no backfill.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "shippingAddressRedactedAt" DATETIME;

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "ReviewHelpfulVote_userId_idx" ON "ReviewHelpfulVote"("userId");
