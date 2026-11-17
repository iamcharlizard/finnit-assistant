-- Rollback for migration 20261124090000_alias_direction.
-- Loses: which automatic names say their movements are income or expenses.
-- Movements already turned around keep their type.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261124090000_alias_direction.sql

BEGIN;
ALTER TABLE "MerchantAlias" DROP COLUMN IF EXISTS "direction";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261124090000_alias_direction';
COMMIT;
