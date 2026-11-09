-- Rollback of 20261121090000_card_installments and
-- 20261121090100_card_installments_data: the MSI plans go back to plain
-- recurring expenses of kind installment (their occurrences stay), every
-- card_installments debt and its payments are deleted, the purchase column
-- goes away and LoanType is rebuilt without card_installments (Postgres
-- can't drop an enum value).
BEGIN;

UPDATE "RecurringExpense" re
SET "debtId" = NULL
FROM "Debt" d
WHERE re."debtId" = d."id" AND d."loanType" = 'card_installments';

DELETE FROM "DebtPayment" dp
USING "Debt" d
WHERE dp."debtId" = d."id" AND d."loanType" = 'card_installments';
DELETE FROM "DebtCharge" dc
USING "Debt" d
WHERE dc."debtId" = d."id" AND d."loanType" = 'card_installments';
DELETE FROM "Debt" WHERE "loanType" = 'card_installments';

ALTER TABLE "Debt" DROP CONSTRAINT IF EXISTS "Debt_purchaseTransactionId_fkey";
DROP INDEX IF EXISTS "Debt_purchaseTransactionId_key";
ALTER TABLE "Debt" DROP COLUMN IF EXISTS "purchaseTransactionId";

UPDATE "RecurringSuggestionState" SET "aiLoanType" = NULL
WHERE "aiLoanType" = 'card_installments';

ALTER TYPE "LoanType" RENAME TO "LoanType_old";
CREATE TYPE "LoanType" AS ENUM ('institutional', 'personal', 'purchase_financing');
ALTER TABLE "Debt" ALTER COLUMN "loanType" TYPE "LoanType"
  USING "loanType"::text::"LoanType";
ALTER TABLE "RecurringSuggestionState" ALTER COLUMN "aiLoanType" TYPE "LoanType"
  USING "aiLoanType"::text::"LoanType";
DROP TYPE "LoanType_old";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" IN ('20261121090000_card_installments', '20261121090100_card_installments_data');
COMMIT;
