-- A scheduled payment can be moved to another day (e.g. a Kueski
-- installment due on the 12th instead of the 15th). It keeps the date the
-- schedule gave it so it is not generated again there. Additive: one
-- nullable column.
-- Rollback: ../../../scripts/rollbacks/20261107090000_occurrence_original_due_date.sql
BEGIN;
ALTER TABLE "RecurringOccurrence" ADD COLUMN "originalDueDate" DATE;
COMMIT;
