-- Rollback for migration 20261106090000_debt_description.
-- Loses: the description of each loan's first amount.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261106090000_debt_description.sql

BEGIN;
ALTER TABLE "Debt" DROP COLUMN IF EXISTS "description";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261106090000_debt_description';
COMMIT;
