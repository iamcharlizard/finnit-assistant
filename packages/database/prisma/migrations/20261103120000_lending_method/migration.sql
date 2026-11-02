-- How a personal loan (and each later amount) was lent: cash, transfer,
-- the lender's credit or debit card, other. Additive: an enum and two
-- nullable columns.
-- Rollback: ../../../scripts/rollbacks/20261103120000_lending_method.sql
BEGIN;
CREATE TYPE "LendingMethod" AS ENUM ('cash', 'transfer', 'credit_card', 'debit_card', 'other');
ALTER TABLE "Debt" ADD COLUMN "lendingMethod" "LendingMethod";
ALTER TABLE "DebtCharge" ADD COLUMN "lendingMethod" "LendingMethod";
COMMIT;
