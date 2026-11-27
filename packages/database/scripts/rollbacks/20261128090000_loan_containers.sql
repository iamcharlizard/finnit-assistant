-- Rollback for 20261128090000_loan_containers.
-- Puts each container's first amount (the charge 'initial-<debtId>') back on
-- its Debt and deletes that charge; drops DebtPaymentAllocation and
-- RecurringOccurrence.paidAmount (payments split across scheduled payments
-- stay as payments of the loan; paid-in-part rows go back to open), and
-- restores the unique debt name per user.
-- The unique index fails if two debts of a user now share a name: rename
-- them first.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261128090000_loan_containers.sql
BEGIN;

UPDATE "Debt" d
SET
  "principal" = c."principal",
  "totalToRepay" = c."totalToRepay",
  "description" = c."description",
  "destination" = c."destination",
  "depositAddsToBalance" = c."depositAddsToBalance",
  "purposeCategoryId" = c."purposeCategoryId",
  "lendingMethod" = c."lendingMethod",
  "installmentsTotal" = COALESCE(c."installments", d."installmentsTotal"),
  "interestMode" = COALESCE(c."interestMode", d."interestMode"),
  "interestRateAnnual" = COALESCE(c."interestRateAnnual", d."interestRateAnnual"),
  "includesVat" = c."includesVat" OR d."includesVat",
  "updatedAt" = now()
FROM "DebtCharge" c
WHERE c."id" = 'initial-' || d."id";

-- The deposit moves back to the debt (unique per table).
CREATE TEMP TABLE "_initial_deposit" ON COMMIT DROP AS
SELECT "debtId", "transactionId" FROM "DebtCharge"
WHERE "id" LIKE 'initial-%' AND "transactionId" IS NOT NULL;
UPDATE "DebtCharge" SET "transactionId" = NULL WHERE "id" LIKE 'initial-%';
UPDATE "Debt" d SET "disbursementTransactionId" = x."transactionId"
FROM "_initial_deposit" x WHERE x."debtId" = d."id";

UPDATE "DebtPayment" SET "chargeId" = NULL WHERE "chargeId" LIKE 'initial-%';
DELETE FROM "DebtCharge" WHERE "id" LIKE 'initial-%';

DROP TABLE IF EXISTS "DebtPaymentAllocation";
ALTER TABLE "RecurringOccurrence" DROP COLUMN IF EXISTS "paidAmount";

CREATE UNIQUE INDEX "Debt_userId_name_key" ON "Debt"("userId", "name");

DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261128090000_loan_containers';

COMMIT;
