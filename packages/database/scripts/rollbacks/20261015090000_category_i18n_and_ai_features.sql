-- Rollback for migrations 20261015090100_ai_feature_defaults and
-- 20261015090000_category_i18n_and_ai_features.
-- Loses: category translations (user-created categories keep their English
-- Category.name), category keys, users' locale, and the settings of the
-- AI features added there. PostgreSQL can't drop enum values, so
-- "AiFeatureKey" is recreated with only 'statement_parsing'.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261015090000_category_i18n_and_ai_features.sql

BEGIN;
DELETE FROM "AiFeature" WHERE "key" <> 'statement_parsing';
ALTER TYPE "AiFeatureKey" RENAME TO "AiFeatureKey_old";
CREATE TYPE "AiFeatureKey" AS ENUM ('statement_parsing');
ALTER TABLE "AiFeature"
  ALTER COLUMN "key" TYPE "AiFeatureKey" USING ("key"::text::"AiFeatureKey");
DROP TYPE "AiFeatureKey_old";

DROP TABLE IF EXISTS "CategoryTranslation";
DROP INDEX IF EXISTS "Category_userId_key_key";
ALTER TABLE "Category" DROP COLUMN IF EXISTS "key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "locale";
DROP TYPE IF EXISTS "TranslationSource";

DELETE FROM "_prisma_migrations" WHERE "migration_name" IN (
  '20261015090100_ai_feature_defaults',
  '20261015090000_category_i18n_and_ai_features'
);
COMMIT;
