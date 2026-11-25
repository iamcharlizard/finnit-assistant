-- The result of each scheduled bank sync, per connection (bank_sync):
-- updated, with how many new movements, or why it couldn't be updated.
-- No rows use the new value here (it can't be used in the same
-- transaction that adds it).
-- Rollback: ../../../scripts/rollbacks/20261126090000_bank_sync_notification.sql
BEGIN;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'bank_sync';

COMMIT;
