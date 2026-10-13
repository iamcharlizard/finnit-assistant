-- Rollback for migration 20261017090000_merchant_rules_and_aliases.
-- Loses: merchant aliases and merchant rules, one-off display names and
-- private marks on transactions, category sources and pending category
-- suggestions. Categories already applied to transactions are kept, and the
-- original descriptions were never modified.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261017090000_merchant_rules_and_aliases.sql

BEGIN;
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_aliasId_fkey";
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_suggestedCategoryId_fkey";
DROP INDEX IF EXISTS "Transaction_aliasId_idx";
DROP INDEX IF EXISTS "Transaction_suggestedCategoryId_idx";
ALTER TABLE "Transaction"
  DROP COLUMN IF EXISTS "aliasId",
  DROP COLUMN IF EXISTS "aliasName",
  DROP COLUMN IF EXISTS "isPrivate",
  DROP COLUMN IF EXISTS "categorySource",
  DROP COLUMN IF EXISTS "suggestedCategoryId",
  DROP COLUMN IF EXISTS "suggestedBy";

DROP TABLE IF EXISTS "MerchantAlias";
DROP TABLE IF EXISTS "MerchantRule";
DROP TYPE IF EXISTS "AliasMatchType";
DROP TYPE IF EXISTS "CategorySource";

-- Created by the migration and used by nothing else.
DROP EXTENSION IF EXISTS unaccent;

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261017090000_merchant_rules_and_aliases';
COMMIT;
