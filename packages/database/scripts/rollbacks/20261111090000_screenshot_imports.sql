-- Rollback for migrations 20261111090000_screenshot_imports and
-- 20261111090100_screenshot_parsing_default.
-- Loses: screenshot imports and their lines (movements already created
-- stay), the "en proceso" marks (those movements stay as normal ones) and
-- the screenshot_parsing AI setting.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261111090000_screenshot_imports.sql

BEGIN;
DELETE FROM "ImportedTransaction" WHERE "screenshotImportId" IS NOT NULL;
ALTER TABLE "ImportedTransaction" DROP CONSTRAINT IF EXISTS "ImportedTransaction_screenshotImportId_fkey";
DROP INDEX IF EXISTS "ImportedTransaction_screenshotImportId_idx";
ALTER TABLE "ImportedTransaction" DROP COLUMN IF EXISTS "screenshotImportId";
ALTER TABLE "ImportedTransaction" DROP COLUMN IF EXISTS "inProcess";
ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "inProcess";
DROP TABLE IF EXISTS "ScreenshotImport";

DELETE FROM "AiFeature" WHERE "key" = 'screenshot_parsing';
ALTER TYPE "AiFeatureKey" RENAME TO "AiFeatureKey_old";
CREATE TYPE "AiFeatureKey" AS ENUM ('statement_parsing', 'transaction_categorization', 'recurring_classification', 'receipt_parsing', 'translation');
ALTER TABLE "AiFeature" ALTER COLUMN "key" TYPE "AiFeatureKey" USING "key"::text::"AiFeatureKey";
DROP TYPE "AiFeatureKey_old";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" IN ('20261111090000_screenshot_imports', '20261111090100_screenshot_parsing_default');
COMMIT;
