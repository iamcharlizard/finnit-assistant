-- Rollback for migration 20261109090000_transaction_balance_effect.
-- Loses: each movement's signed effect on its balance. Adjustments that
-- lowered a balance get their negative amount back (the previous way of
-- storing balance updates).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261109090000_transaction_balance_effect.sql

BEGIN;
UPDATE "Transaction" SET "amount" = "balanceEffect"
WHERE "type" = 'adjustment' AND "balanceEffect" < 0;
ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "balanceEffect";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261109090000_transaction_balance_effect';
COMMIT;
