-- Whether a loan's (or a later amount's) deposited money was added to an
-- account's balance. False = the money was already spent (e.g. an old loan):
-- only the debt is recorded, without a movement. Additive: two columns with
-- a default; deposits that have no movement are marked false.
-- Rollback: ../../../scripts/rollbacks/20261108090000_deposit_adds_to_balance.sql
BEGIN;
ALTER TABLE "Debt" ADD COLUMN "depositAddsToBalance" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "DebtCharge" ADD COLUMN "depositAddsToBalance" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Debt" SET "depositAddsToBalance" = false
WHERE "destination" = 'deposit' AND "disbursementTransactionId" IS NULL;
UPDATE "DebtCharge" SET "depositAddsToBalance" = false
WHERE "destination" = 'deposit' AND "transactionId" IS NULL;
COMMIT;
