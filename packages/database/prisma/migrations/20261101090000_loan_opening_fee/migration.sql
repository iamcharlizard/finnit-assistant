-- Opening fee of a loan (comisión por apertura). Additive: one nullable column.
-- Rollback: ../../../scripts/rollbacks/20261101090000_loan_opening_fee.sql
BEGIN;
ALTER TABLE "Debt" ADD COLUMN "openingFee" DECIMAL(18,2);
COMMIT;
