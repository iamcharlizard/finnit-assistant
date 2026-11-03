-- Rollback for migration 20261107090000_occurrence_original_due_date.
-- Moved payments go back to their scheduled date (dueDate is restored from
-- originalDueDate, unless another payment already has that date).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261107090000_occurrence_original_due_date.sql

BEGIN;
UPDATE "RecurringOccurrence" o
SET "dueDate" = o."originalDueDate"
WHERE o."originalDueDate" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "RecurringOccurrence" x
    WHERE x."recurringExpenseId" = o."recurringExpenseId"
      AND x."dueDate" = o."originalDueDate"
  );
ALTER TABLE "RecurringOccurrence" DROP COLUMN IF EXISTS "originalDueDate";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261107090000_occurrence_original_due_date';
COMMIT;
