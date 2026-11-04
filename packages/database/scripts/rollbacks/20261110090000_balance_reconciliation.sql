-- Rollback for migration 20261110090000_balance_reconciliation.
-- Loses: the open "Diferencia con el banco" adjustments become ordinary
-- adjustments (their movements and the balances stay), the last reconciled
-- bank balances, and balance_mismatch notifications (deleted: the enum
-- value is removed by recreating the type).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261110090000_balance_reconciliation.sql

BEGIN;
ALTER TABLE "LinkedAccount" DROP COLUMN IF EXISTS "reconciledAt";
ALTER TABLE "LinkedAccount" DROP COLUMN IF EXISTS "reconciledBalance";

ALTER TABLE "Account" DROP CONSTRAINT IF EXISTS "Account_bankDifferenceTransactionId_fkey";
DROP INDEX IF EXISTS "Account_bankDifferenceTransactionId_key";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "bankDifferenceTransactionId";

DELETE FROM "Notification" WHERE "type" = 'balance_mismatch';
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
CREATE TYPE "NotificationType" AS ENUM ('budget', 'debt_due', 'recurring', 'summary');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType"
  USING "type"::text::"NotificationType";
DROP TYPE "NotificationType_old";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261110090000_balance_reconciliation';
COMMIT;
