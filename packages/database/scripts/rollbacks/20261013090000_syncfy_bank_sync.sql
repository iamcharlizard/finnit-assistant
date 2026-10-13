-- Rollback for migration 20261013090000_syncfy_bank_sync
-- Drops the Finnit <-> Syncfy user mapping and the sync state columns. Linked
-- accounts that were never mapped to a Finnit account are deleted, because
-- accountId becomes required again. Enum values 'syncfy' and 'deposit' cannot
-- be dropped in Postgres and stay.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261013090000_syncfy_bank_sync.sql

BEGIN;
DROP TABLE "BankProviderUser";
DROP INDEX IF EXISTS "BankConnection_userId_idx";
ALTER TABLE "BankConnection"
  DROP COLUMN "lastPullRequestedAt",
  DROP COLUMN "lastStatusCode",
  DROP COLUMN "providerUserId",
  DROP COLUMN "transactionsCursor";

DELETE FROM "LinkedAccount" WHERE "accountId" IS NULL;
ALTER TABLE "LinkedAccount" DROP CONSTRAINT "LinkedAccount_accountId_fkey";
ALTER TABLE "LinkedAccount"
  DROP COLUMN "availableCredit",
  DROP COLUMN "balance",
  DROP COLUMN "balanceUpdatedAt",
  DROP COLUMN "creditLimit",
  ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "LinkedAccount" ADD CONSTRAINT "LinkedAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "ImportedTransaction" SET "kind" = 'refund' WHERE "kind" = 'deposit';
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261013090000_syncfy_bank_sync';
COMMIT;
