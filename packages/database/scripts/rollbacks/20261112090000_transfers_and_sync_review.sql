-- Rollback for migration 20261112090000_transfers_and_sync_review.
-- Loses: transfer suggestions, "goes to my account" on merchant aliases and
-- uncategorized notifications (deleted: the enum value is removed by
-- recreating the type). Transfers made by conversion stay transfers, but can
-- no longer be undone (their original type is dropped).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261112090000_transfers_and_sync_review.sql

BEGIN;
DROP TABLE IF EXISTS "TransferSuggestion";
DROP TYPE IF EXISTS "TransferSuggestionStatus";
DROP TYPE IF EXISTS "TransferSuggestionReason";

ALTER TABLE "MerchantAlias" DROP CONSTRAINT IF EXISTS "MerchantAlias_transferAccountId_fkey";
DROP INDEX IF EXISTS "MerchantAlias_transferAccountId_idx";
ALTER TABLE "MerchantAlias" DROP COLUMN IF EXISTS "transferAccountId";

ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "originalType";
ALTER TABLE "Transfer" DROP COLUMN IF EXISTS "convertedAt";

DELETE FROM "Notification" WHERE "type" = 'uncategorized';
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
CREATE TYPE "NotificationType" AS ENUM ('budget', 'debt_due', 'recurring', 'summary', 'balance_mismatch');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType"
  USING "type"::text::"NotificationType";
DROP TYPE "NotificationType_old";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261112090000_transfers_and_sync_review';
COMMIT;
