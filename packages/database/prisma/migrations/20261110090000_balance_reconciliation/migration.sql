-- Reconciling linked accounts with the bank's balance. Additive:
--   NotificationType gains balance_mismatch (not used by this migration).
--   Account.bankDifferenceTransactionId: the one open adjustment that makes
--     the recorded balance match the bank's ("Diferencia con el banco").
--   LinkedAccount.reconciledBalance / reconciledAt: the bank's balance at
--     the last reconciliation; null until the next sync takes it as a start.
-- Rollback: ../../../scripts/rollbacks/20261110090000_balance_reconciliation.sql
BEGIN;
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'balance_mismatch';

ALTER TABLE "Account" ADD COLUMN "bankDifferenceTransactionId" TEXT;
CREATE UNIQUE INDEX "Account_bankDifferenceTransactionId_key"
  ON "Account"("bankDifferenceTransactionId");
ALTER TABLE "Account" ADD CONSTRAINT "Account_bankDifferenceTransactionId_fkey"
  FOREIGN KEY ("bankDifferenceTransactionId") REFERENCES "Transaction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LinkedAccount" ADD COLUMN "reconciledBalance" DECIMAL(18,2);
ALTER TABLE "LinkedAccount" ADD COLUMN "reconciledAt" TIMESTAMP(3);
COMMIT;
