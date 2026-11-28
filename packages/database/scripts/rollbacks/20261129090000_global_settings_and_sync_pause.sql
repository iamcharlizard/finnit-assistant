-- Rollback for 20261129090000_global_settings_and_sync_pause.
-- Drops GlobalSettings (the admin's bank sync switch: the API then syncs as
-- if it were on) and BankConnection.syncPausedAt (paused connections sync
-- again). Deploy an API image older than this migration first.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261129090000_global_settings_and_sync_pause.sql
BEGIN;

DROP TABLE IF EXISTS "GlobalSettings";
ALTER TABLE "BankConnection" DROP COLUMN IF EXISTS "syncPausedAt";

DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261129090000_global_settings_and_sync_pause';

COMMIT;
