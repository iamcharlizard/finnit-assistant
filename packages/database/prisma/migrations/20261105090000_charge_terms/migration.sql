-- Terms of each later amount of a loan: when its first installment is due
-- (it may skip the next due date, e.g. a Kueski purchase that starts the
-- quincena after) and how its interest was given (mode, annual rate, VAT),
-- so editing it shows what was entered. Additive: four columns.
-- Rollback: ../../../scripts/rollbacks/20261105090000_charge_terms.sql
BEGIN;
ALTER TABLE "DebtCharge" ADD COLUMN "firstPaymentDate" DATE;
ALTER TABLE "DebtCharge" ADD COLUMN "interestMode" "LoanInterestMode";
ALTER TABLE "DebtCharge" ADD COLUMN "interestRateAnnual" DECIMAL(9,4);
ALTER TABLE "DebtCharge" ADD COLUMN "includesVat" BOOLEAN NOT NULL DEFAULT false;
COMMIT;
