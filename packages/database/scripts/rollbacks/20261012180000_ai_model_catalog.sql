-- Rollback for migration 20261012180000_ai_model_catalog
-- Drops the AI model catalog (configuration only; no user data).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261012180000_ai_model_catalog.sql

BEGIN;
DROP TABLE "AiModel";
DROP TYPE "AiProvider";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261012180000_ai_model_catalog';
COMMIT;
