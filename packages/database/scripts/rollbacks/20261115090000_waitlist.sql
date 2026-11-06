-- Rollback for migration 20261115090000_waitlist.
-- Loses: the waitlist emails (export them first if you need them:
--   \copy "WaitlistEntry" TO 'waitlist.csv' CSV HEADER).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261115090000_waitlist.sql

BEGIN;
DROP TABLE IF EXISTS "WaitlistEntry";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261115090000_waitlist';
COMMIT;
