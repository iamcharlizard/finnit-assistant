-- Rollback for migration 20261102120000_loan_periodic_fee.
-- Loses: the fee per payment of each loan (installment amounts and totals
-- already stored keep it).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261102120000_loan_periodic_fee.sql

BEGIN;
ALTER TABLE "Debt" DROP COLUMN IF EXISTS "periodicFee";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261102120000_loan_periodic_fee';
COMMIT;
