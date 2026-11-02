-- Rollback for migration 20261102090000_debt_categories.
-- Loses: the purpose category of loans and charges, and the "Loans & Debts"
-- categories (movements and recurring payments in them become uncategorized).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261102090000_debt_categories.sql

BEGIN;
ALTER TABLE "DebtCharge" DROP CONSTRAINT IF EXISTS "DebtCharge_purposeCategoryId_fkey";
ALTER TABLE "Debt" DROP CONSTRAINT IF EXISTS "Debt_purposeCategoryId_fkey";
ALTER TABLE "DebtCharge" DROP COLUMN IF EXISTS "purposeCategoryId";
ALTER TABLE "Debt" DROP COLUMN IF EXISTS "purposeCategoryId";

-- Children first; translations, budget caps and rules cascade, references
-- from movements and recurring payments are set to null.
DELETE FROM "Category"
WHERE "userId" IS NOT NULL
  AND "key" IN ('categories.debts.loan_payments', 'categories.debts.installment_payments');
DELETE FROM "Category"
WHERE "userId" IS NOT NULL AND "key" = 'categories.debts';

UPDATE "Category"
SET "sortOrder" = "sortOrder" - 1
WHERE "userId" IS NOT NULL
  AND "parentId" IS NULL
  AND "key" IN ('categories.income', 'categories.uncategorized')
  AND "sortOrder" IS NOT NULL;

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261102090000_debt_categories';
COMMIT;
