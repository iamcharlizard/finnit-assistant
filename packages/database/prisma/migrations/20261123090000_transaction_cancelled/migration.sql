-- A movement the bank cancelled ("Cancelado"): it stays in the history but
-- no longer counts in its account's balance, the card's cycles, totals or
-- charts. Set by hand (credit card movements) or by a bank sync that reports
-- the movement deleted/disabled (movement_cancelled notification). No rows
-- use the new enum value here (it can't be used in the same transaction).
-- Rollback: ../../../scripts/rollbacks/20261123090000_transaction_cancelled.sql
BEGIN;

ALTER TABLE "Transaction" ADD COLUMN "cancelledAt" TIMESTAMP(3);
CREATE INDEX "Transaction_userId_cancelledAt_idx" ON "Transaction"("userId", "cancelledAt");

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'movement_cancelled';

COMMIT;
