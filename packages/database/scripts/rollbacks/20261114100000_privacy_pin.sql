-- Rollback for migration 20261114100000_privacy_pin.
-- Loses: the users' privacy PINs, which rules were protected (they stay
-- private rules) and pending reset links.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261114100000_privacy_pin.sql

BEGIN;
DROP TABLE IF EXISTS "PrivacyPinReset";
ALTER TABLE "MerchantAlias" DROP COLUMN IF EXISTS "isProtected";
ALTER TABLE "User" DROP COLUMN IF EXISTS "privacyPinHash";
ALTER TABLE "User" DROP COLUMN IF EXISTS "privacyPinVersion";
ALTER TABLE "User" DROP COLUMN IF EXISTS "privacyPinFailedAttempts";
ALTER TABLE "User" DROP COLUMN IF EXISTS "privacyPinLockedUntil";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261114100000_privacy_pin';
COMMIT;
