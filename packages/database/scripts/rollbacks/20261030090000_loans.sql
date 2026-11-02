-- Rollback for migration 20261030090000_loans.
-- Loses: loan types and terms, AI loan details of suggestions, debt charges, and historical payments (payments
-- without a transaction are deleted, so balances of those debts go back up).
-- Transactions created for disbursements or charges are kept.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261030090000_loans.sql

BEGIN;
DROP TABLE IF EXISTS "DebtCharge";

ALTER TABLE "RecurringSuggestionState"
  DROP COLUMN IF EXISTS "aiLoanType",
  DROP COLUMN IF EXISTS "aiLenderName",
  DROP COLUMN IF EXISTS "loanClassifiedAt";

DELETE FROM "DebtPayment" WHERE "transactionId" IS NULL;
ALTER TABLE "DebtPayment" ALTER COLUMN "transactionId" SET NOT NULL;
ALTER TABLE "DebtPayment" DROP COLUMN IF EXISTS "isHistorical";

ALTER TABLE "Debt" DROP CONSTRAINT IF EXISTS "Debt_disbursementTransactionId_fkey";
DROP INDEX IF EXISTS "Debt_disbursementTransactionId_key";
ALTER TABLE "Debt"
  DROP COLUMN IF EXISTS "destination",
  DROP COLUMN IF EXISTS "disbursementTransactionId",
  DROP COLUMN IF EXISTS "includesVat",
  DROP COLUMN IF EXISTS "installmentAmount",
  DROP COLUMN IF EXISTS "installmentsTotal",
  DROP COLUMN IF EXISTS "interestMode",
  DROP COLUMN IF EXISTS "lenderName",
  DROP COLUMN IF EXISTS "loanType",
  DROP COLUMN IF EXISTS "paymentFrequency",
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "totalToRepay",
  DROP COLUMN IF EXISTS "updatedAt";

DROP TYPE IF EXISTS "DebtChargeDestination";
DROP TYPE IF EXISTS "DebtStatus";
DROP TYPE IF EXISTS "LoanInterestMode";
DROP TYPE IF EXISTS "LoanType";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261030090000_loans';
COMMIT;
