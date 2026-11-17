-- Rollback for migrations 20261125090000_recurring_essentials and
-- 20261125090100_recurring_essentials_default: removes the questionnaire
-- answers, the AI's classification of recurring expenses and the
-- recurring_essentials AI feature (Postgres can't drop an enum value, so
-- AiFeatureKey is recreated).
-- Loses: every user's answers and the essential / reducible / dispensable
-- classification of their recurring expenses.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261125090000_recurring_essentials.sql

BEGIN;
DROP TABLE IF EXISTS "RecurringEssentialProfile";
ALTER TABLE "RecurringExpense"
  DROP COLUMN IF EXISTS "essentialLevel",
  DROP COLUMN IF EXISTS "essentialReason",
  DROP COLUMN IF EXISTS "essentialAt";
DROP TYPE IF EXISTS "EssentialLevel";

DELETE FROM "AiFeature" WHERE "key" = 'recurring_essentials';
ALTER TYPE "AiFeatureKey" RENAME TO "AiFeatureKey_old";
CREATE TYPE "AiFeatureKey" AS ENUM ('statement_parsing', 'transaction_categorization', 'recurring_classification', 'receipt_parsing', 'translation', 'screenshot_parsing', 'alias_pattern');
ALTER TABLE "AiFeature" ALTER COLUMN "key" TYPE "AiFeatureKey" USING "key"::text::"AiFeatureKey";
DROP TYPE "AiFeatureKey_old";

DELETE FROM "_prisma_migrations" WHERE "migration_name" IN ('20261125090000_recurring_essentials', '20261125090100_recurring_essentials_default');
COMMIT;
