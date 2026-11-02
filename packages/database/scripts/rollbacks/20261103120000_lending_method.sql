-- Rollback for migration 20261103120000_lending_method.
-- Loses: how each personal loan and later amount was lent.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261103120000_lending_method.sql

BEGIN;
ALTER TABLE "DebtCharge" DROP COLUMN IF EXISTS "lendingMethod";
ALTER TABLE "Debt" DROP COLUMN IF EXISTS "lendingMethod";
DROP TYPE IF EXISTS "LendingMethod";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261103120000_lending_method';
COMMIT;
