-- Rollback for migration 20261103090000_contacts.
-- Loses: the contacts list. Loans keep their lender's name (lenderName).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261103090000_contacts.sql

BEGIN;
ALTER TABLE "Debt" DROP CONSTRAINT IF EXISTS "Debt_lenderContactId_fkey";
ALTER TABLE "Debt" DROP COLUMN IF EXISTS "lenderContactId";
DROP TABLE IF EXISTS "Contact";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261103090000_contacts';
COMMIT;
