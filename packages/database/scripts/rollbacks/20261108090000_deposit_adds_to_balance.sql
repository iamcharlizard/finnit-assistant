-- Rollback for migration 20261108090000_deposit_adds_to_balance.
-- Loses: the explicit flag (it can still be told from whether the deposit
-- has a movement).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261108090000_deposit_adds_to_balance.sql

BEGIN;
ALTER TABLE "DebtCharge" DROP COLUMN IF EXISTS "depositAddsToBalance";
ALTER TABLE "Debt" DROP COLUMN IF EXISTS "depositAddsToBalance";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261108090000_deposit_adds_to_balance';
COMMIT;
