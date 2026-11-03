-- What the first amount of a loan was (e.g. the first Kueski purchase), so
-- its installments are labelled like those of later purchases. Additive:
-- one nullable column.
-- Rollback: ../../../scripts/rollbacks/20261106090000_debt_description.sql
BEGIN;
ALTER TABLE "Debt" ADD COLUMN "description" TEXT;
COMMIT;
