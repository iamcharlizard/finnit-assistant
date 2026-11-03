-- Rollback for migration 20261104090000_charge_installments_paid.
-- Loses: which historical payments belong to which later amount, and how
-- many installments of each were paid before registering it. The payments
-- themselves stay (the balance does not change), but the schedule would
-- ask again for those installments.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261104090000_charge_installments_paid.sql

BEGIN;
ALTER TABLE "DebtPayment" DROP CONSTRAINT IF EXISTS "DebtPayment_chargeId_fkey";
DROP INDEX IF EXISTS "DebtPayment_chargeId_idx";
ALTER TABLE "DebtPayment" DROP COLUMN IF EXISTS "chargeId";
ALTER TABLE "DebtCharge" DROP COLUMN IF EXISTS "installmentsPaid";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261104090000_charge_installments_paid';
COMMIT;
