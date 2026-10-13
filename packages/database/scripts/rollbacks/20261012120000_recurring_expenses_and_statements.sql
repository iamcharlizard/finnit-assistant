-- Rollback for migration 20261012120000_recurring_expenses_and_statements
--
-- DATA LOSS: drops every recurring expense, occurrence, statement import and
-- statement line. Bank lines (ImportedTransaction with linkedAccountId) are kept.
-- Back up first: pnpm turbo run db:backup --filter=@finnit/database
--
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261012120000_recurring_expenses_and_statements.sql

BEGIN;

-- Statement lines have no linked account and cannot exist in the old schema
DELETE FROM "ImportedTransaction" WHERE "linkedAccountId" IS NULL OR "providerTxnId" IS NULL;

ALTER TABLE "ImportedTransaction" DROP CONSTRAINT IF EXISTS "ImportedTransaction_accountId_fkey";
ALTER TABLE "ImportedTransaction" DROP CONSTRAINT IF EXISTS "ImportedTransaction_statementImportId_fkey";
ALTER TABLE "ImportedTransaction" DROP CONSTRAINT IF EXISTS "ImportedTransaction_matchedOccurrenceId_fkey";
DROP INDEX IF EXISTS "ImportedTransaction_statementImportId_idx";
DROP INDEX IF EXISTS "ImportedTransaction_accountId_date_idx";
ALTER TABLE "ImportedTransaction"
  DROP COLUMN "accountId",
  DROP COLUMN "description",
  DROP COLUMN "installmentNumber",
  DROP COLUMN "installmentTotal",
  DROP COLUMN "kind",
  DROP COLUMN "matchedOccurrenceId",
  DROP COLUMN "postDate",
  DROP COLUMN "statementImportId",
  DROP COLUMN "status",
  DROP COLUMN "suggestedCategoryId",
  ALTER COLUMN "linkedAccountId" SET NOT NULL,
  ALTER COLUMN "providerTxnId" SET NOT NULL;

ALTER TABLE "BankConnection"
  DROP COLUMN "errorMessage",
  DROP COLUMN "institution",
  DROP COLUMN "lastSyncedAt";

DROP TABLE "StatementImport";
DROP TABLE "RecurringOccurrence";
DROP TABLE "RecurringExpense";

DROP TYPE "ImportedLineStatus";
DROP TYPE "ImportedLineKind";
DROP TYPE "StatementStatus";
DROP TYPE "StatementSource";
DROP TYPE "OccurrenceMatchSource";
DROP TYPE "OccurrenceStatus";
DROP TYPE "RecurringTrackingMode";
DROP TYPE "RecurringExpenseKind";

DROP TYPE "RecurringFrequency";
CREATE TYPE "RecurringFrequency" AS ENUM ('daily', 'weekly', 'monthly', 'custom');

CREATE TABLE "RecurringRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultAccountId" TEXT,
    "defaultCategoryId" TEXT,
    "frequency" "RecurringFrequency" NOT NULL,
    "interval" SMALLINT NOT NULL,
    "byday" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "amount" DECIMAL(18,2) NOT NULL,
    "merchantName" TEXT,
    "autoConfirm" BOOLEAN NOT NULL DEFAULT false,
    "nextOccurrence" TIMESTAMP(3),
    "templateOverrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecurringRule_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_defaultAccountId_fkey" FOREIGN KEY ("defaultAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Transactions created with source 'statement' are kept but relabeled, because
-- Postgres cannot drop an enum value. The 'statement' value stays in the type.
UPDATE "Transaction" SET "source" = 'imported' WHERE "source" = 'statement';

-- Restoring the one-per-day unique index FAILS if an account has more than one
-- transaction on the same day, which this migration made possible. Resolve
-- duplicates before running this statement:
--   SELECT "userId", "accountId", "txnDate", count(*) FROM "Transaction"
--   GROUP BY 1, 2, 3 HAVING count(*) > 1;
CREATE UNIQUE INDEX "Transaction_userId_accountId_txnDate_key" ON "Transaction"("userId", "accountId", "txnDate");

DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261012120000_recurring_expenses_and_statements';

COMMIT;
