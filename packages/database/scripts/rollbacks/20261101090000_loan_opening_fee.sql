-- Rollback for migration 20261101090000_loan_opening_fee.
-- Loses: the opening fee of each loan (deposits already recorded are kept).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261101090000_loan_opening_fee.sql

BEGIN;
ALTER TABLE "Debt" DROP COLUMN IF EXISTS "openingFee";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261101090000_loan_opening_fee';
COMMIT;
