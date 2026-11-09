-- Rollback of 20261120090000_card_notifications: deletes the credit card
-- reminders and removes their NotificationType values (Postgres can't drop
-- an enum value, so the type is rebuilt without them).
BEGIN;

DELETE FROM "Notification"
WHERE "type" IN ('card_statement', 'card_due', 'card_unpaid');

ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
CREATE TYPE "NotificationType" AS ENUM ('budget', 'debt_due', 'recurring', 'summary', 'balance_mismatch', 'uncategorized');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType"
  USING "type"::text::"NotificationType";
DROP TYPE "NotificationType_old";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261120090000_card_notifications';
COMMIT;
