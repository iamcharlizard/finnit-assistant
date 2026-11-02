-- Fixed fee charged with every loan payment (administración / seguro), VAT
-- included. Additive: one nullable column.
-- Rollback: ../../../scripts/rollbacks/20261102120000_loan_periodic_fee.sql
BEGIN;
ALTER TABLE "Debt" ADD COLUMN "periodicFee" DECIMAL(18,2);
COMMIT;
