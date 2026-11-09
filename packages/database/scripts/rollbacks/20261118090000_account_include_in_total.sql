-- Rollback for migration 20261118090000_account_include_in_total.
-- Loses: which accounts the users left out of their total balance.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261118090000_account_include_in_total.sql

BEGIN;
ALTER TABLE "Account" DROP COLUMN IF EXISTS "includeInTotal";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261118090000_account_include_in_total';
COMMIT;
