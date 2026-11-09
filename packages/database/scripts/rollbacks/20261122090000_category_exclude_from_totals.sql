-- Rollback for migration 20261122090000_category_exclude_from_totals.
-- Loses: which categories the users left out of their totals and charts.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261122090000_category_exclude_from_totals.sql

BEGIN;
ALTER TABLE "Category" DROP COLUMN IF EXISTS "excludeFromTotals";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261122090000_category_exclude_from_totals';
COMMIT;
