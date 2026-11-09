-- Credit card reminders, from the card's cut-off and payment days: the
-- cycle closed (card_statement), its payment is due soon or today
-- (card_due), and it wasn't covered by the due date (card_unpaid).
-- No rows use the new values here (they can't be used in the same
-- transaction that adds them).
-- Rollback: ../../../scripts/rollbacks/20261120090000_card_notifications.sql
BEGIN;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'card_statement';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'card_due';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'card_unpaid';

COMMIT;
