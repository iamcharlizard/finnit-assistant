-- Rollback for migration 20261014090000_admin_access_and_ai_features
-- Users created without a password (Google only) get an unusable password
-- hash, so they can no longer sign in until an admin sets one.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261014090000_admin_access_and_ai_features.sql

BEGIN;
DROP TABLE IF EXISTS "AiFeature";
DROP INDEX IF EXISTS "User_single_master_key";
DROP INDEX IF EXISTS "User_googleSubject_key";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_invitedById_fkey";
UPDATE "User" SET "passwordHash" = 'disabled:no-password' WHERE "passwordHash" IS NULL;
ALTER TABLE "User"
  DROP COLUMN "disabledAt",
  DROP COLUMN "googleSubject",
  DROP COLUMN "invitedById",
  DROP COLUMN "isMaster",
  DROP COLUMN "lastLoginAt",
  DROP COLUMN "role",
  DROP COLUMN "tokenVersion",
  ALTER COLUMN "passwordHash" SET NOT NULL;
DROP TYPE IF EXISTS "AiFeatureKey";
DROP TYPE IF EXISTS "UserRole";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261014090000_admin_access_and_ai_features';
COMMIT;
