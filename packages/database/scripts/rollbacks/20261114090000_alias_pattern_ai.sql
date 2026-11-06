-- Rollback for migrations 20261114090000_alias_pattern_ai and
-- 20261114090100_alias_pattern_ai_default: removes the alias_pattern AI
-- feature (its settings row and the enum value; Postgres can't drop an enum
-- value, so the type is recreated).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261114090000_alias_pattern_ai.sql

BEGIN;
DELETE FROM "AiFeature" WHERE "key" = 'alias_pattern';
ALTER TYPE "AiFeatureKey" RENAME TO "AiFeatureKey_old";
CREATE TYPE "AiFeatureKey" AS ENUM ('statement_parsing', 'transaction_categorization', 'recurring_classification', 'receipt_parsing', 'translation', 'screenshot_parsing');
ALTER TABLE "AiFeature" ALTER COLUMN "key" TYPE "AiFeatureKey" USING "key"::text::"AiFeatureKey";
DROP TYPE "AiFeatureKey_old";
DELETE FROM "_prisma_migrations" WHERE "migration_name" IN ('20261114090000_alias_pattern_ai', '20261114090100_alias_pattern_ai_default');
COMMIT;
