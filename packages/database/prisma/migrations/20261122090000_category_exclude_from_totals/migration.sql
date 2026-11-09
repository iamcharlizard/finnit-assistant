-- Whether a user's own category counts in income/expense totals, reports
-- and charts. Off: its movements stay in the history and still move their
-- account's balance, but no sum or chart includes them (e.g. a
-- "Transferencias (sin seguimiento)" category). Every category counts.
-- Rollback: ../../../scripts/rollbacks/20261122090000_category_exclude_from_totals.sql
BEGIN;
ALTER TABLE "Category" ADD COLUMN "excludeFromTotals" BOOLEAN NOT NULL DEFAULT false;
COMMIT;
