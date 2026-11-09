-- Rollback for migration 20261119090000_duplicate_suggestions.
-- Loses: pending duplicate suggestions and the pairs marked "No es duplicado".
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261119090000_duplicate_suggestions.sql

BEGIN;
DROP TABLE IF EXISTS "DuplicateSuggestion";
DROP TYPE IF EXISTS "DuplicateSuggestionStatus";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261119090000_duplicate_suggestions';
COMMIT;
