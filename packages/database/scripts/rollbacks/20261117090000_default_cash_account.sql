-- Rollback for migration 20261117090000_default_cash_account.
-- Keeps every account (including the cash accounts it created, which may hold
-- movements by now); only drops the "default cash" mark and its index.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261117090000_default_cash_account.sql

BEGIN;
DROP INDEX IF EXISTS "Account_userId_default_cash_key";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "isDefaultCash";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261117090000_default_cash_account';
COMMIT;
