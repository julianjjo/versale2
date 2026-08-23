-- Item 17: los tokens caducables también en verificación de correo.
-- SQLite stores enums/JSON as TEXT; a nullable DATETIME needs no backfill.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "verificationTokenExpires" DATETIME;
