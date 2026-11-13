-- Rollback for migration 20261123090000_transaction_cancelled.
-- Cancelled movements count again: their effect goes back to their account's
-- balance (confirmed ones only) before the column is dropped. Deletes the
-- movement_cancelled notifications and rebuilds NotificationType without it.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261123090000_transaction_cancelled.sql

BEGIN;

UPDATE "Account" AS a
SET "balanceCurrent" = a."balanceCurrent" + c.total
FROM (
  SELECT "accountId", SUM("balanceEffect") AS total
  FROM "Transaction"
  WHERE "cancelledAt" IS NOT NULL AND NOT "isPending" AND "balanceEffect" IS NOT NULL
  GROUP BY "accountId"
) AS c
WHERE a."id" = c."accountId";

DROP INDEX IF EXISTS "Transaction_userId_cancelledAt_idx";
ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "cancelledAt";

DELETE FROM "Notification" WHERE "type" = 'movement_cancelled';
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
CREATE TYPE "NotificationType" AS ENUM ('budget', 'debt_due', 'recurring', 'summary', 'balance_mismatch', 'uncategorized', 'card_statement', 'card_due', 'card_unpaid');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType"
  USING "type"::text::"NotificationType";
DROP TYPE "NotificationType_old";

DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261123090000_transaction_cancelled';
COMMIT;
