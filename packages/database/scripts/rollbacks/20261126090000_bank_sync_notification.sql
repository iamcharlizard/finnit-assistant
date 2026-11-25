-- Rollback of 20261126090000_bank_sync_notification: deletes the bank sync
-- notifications and removes their NotificationType value (Postgres can't
-- drop an enum value, so the type is rebuilt without it).
BEGIN;

DELETE FROM "Notification" WHERE "type" = 'bank_sync';

ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
CREATE TYPE "NotificationType" AS ENUM ('budget', 'debt_due', 'recurring', 'summary', 'balance_mismatch', 'uncategorized', 'card_statement', 'card_due', 'card_unpaid', 'movement_cancelled');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType"
  USING "type"::text::"NotificationType";
DROP TYPE "NotificationType_old";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261126090000_bank_sync_notification';
COMMIT;
