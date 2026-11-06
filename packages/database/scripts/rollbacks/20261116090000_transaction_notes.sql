-- Rollback for migration 20261116090000_transaction_notes.
-- Loses: the notes users wrote on their movements.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261116090000_transaction_notes.sql

BEGIN;
ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "notes";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261116090000_transaction_notes';
COMMIT;
