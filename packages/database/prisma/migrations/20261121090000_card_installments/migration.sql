-- Purchases on a credit card paid in monthly installments (meses con o
-- sin intereses) become debts of loan type card_installments, linked to
-- the card; `purchaseTransactionId` is the card's charge of the whole
-- purchase, when recorded. The existing MSI plans (recurring expenses of
-- kind installment on a credit card) become such debts in
-- 20261121090100_card_installments_data: a new enum value can't be used
-- in the transaction that adds it.
-- Rollback: ../../../scripts/rollbacks/20261121090000_card_installments.sql
BEGIN;

ALTER TYPE "LoanType" ADD VALUE IF NOT EXISTS 'card_installments';

ALTER TABLE "Debt" ADD COLUMN "purchaseTransactionId" TEXT;
CREATE UNIQUE INDEX "Debt_purchaseTransactionId_key" ON "Debt"("purchaseTransactionId");
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_purchaseTransactionId_fkey" FOREIGN KEY ("purchaseTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
