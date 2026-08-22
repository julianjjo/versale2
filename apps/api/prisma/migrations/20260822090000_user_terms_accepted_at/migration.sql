-- Item 8 follow-up: records when a user accepted the signup Terms/18+
-- consent — nullable since accounts created before this column existed have
-- no such record.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" DATETIME;
