-- Installments of a later amount (a purchase on Kueski, 3 MSI on the
-- lender's card) already paid when it was registered: a counter on the
-- charge, and its historical payments point at it. Additive: two columns,
-- a foreign key and an index.
-- Rollback: ../../../scripts/rollbacks/20261104090000_charge_installments_paid.sql
BEGIN;
ALTER TABLE "DebtCharge" ADD COLUMN "installmentsPaid" SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE "DebtPayment" ADD COLUMN "chargeId" TEXT;
CREATE INDEX "DebtPayment_chargeId_idx" ON "DebtPayment"("chargeId");
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "DebtCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;
