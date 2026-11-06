-- The user's notes on a movement (any source; the bank text stays in
-- description/merchantName and is never modified).
-- Rollback: ../../../scripts/rollbacks/20261116090000_transaction_notes.sql
BEGIN;
ALTER TABLE "Transaction" ADD COLUMN "notes" TEXT;
COMMIT;
