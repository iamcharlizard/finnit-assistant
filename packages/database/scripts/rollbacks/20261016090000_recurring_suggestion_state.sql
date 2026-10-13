-- Rollback for migration 20261016090000_recurring_suggestion_state.
-- Loses: dismissed/accepted marks and cached AI classifications of
-- recurring suggestions (suggestions reappear and get classified again).
-- Recurring expenses created by accepting a suggestion are kept.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261016090000_recurring_suggestion_state.sql

BEGIN;
DROP TABLE IF EXISTS "RecurringSuggestionState";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261016090000_recurring_suggestion_state';
COMMIT;
