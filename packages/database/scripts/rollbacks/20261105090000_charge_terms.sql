-- Rollback for migration 20261105090000_charge_terms.
-- Loses: each later amount's first payment date (its installments move back
-- to the first due date after it) and how its interest was given (its total
-- to repay stays).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261105090000_charge_terms.sql

BEGIN;
ALTER TABLE "DebtCharge" DROP COLUMN IF EXISTS "includesVat";
ALTER TABLE "DebtCharge" DROP COLUMN IF EXISTS "interestRateAnnual";
ALTER TABLE "DebtCharge" DROP COLUMN IF EXISTS "interestMode";
ALTER TABLE "DebtCharge" DROP COLUMN IF EXISTS "firstPaymentDate";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261105090000_charge_terms';
COMMIT;
