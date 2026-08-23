-- Borrado de cuenta con anonimización.
-- SQLite stores enums/JSON as TEXT; nullable DATETIME columns need no backfill.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "shippingAddressRedactedAt" DATETIME;
