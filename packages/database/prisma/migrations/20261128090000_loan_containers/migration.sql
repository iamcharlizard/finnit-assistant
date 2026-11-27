-- Purchase financing and personal loans become containers: their first
-- amount (until now on the Debt itself) becomes one more DebtCharge, with
-- id 'initial-<debtId>', so every purchase or amount is listed and edited
-- the same way. Balances and schedules stay the same: the charge has the
-- terms the ledger already derived from the debt (financedCharges), and
-- payments are not touched.
-- Payments can now be split across scheduled payments, or cover part of
-- one: DebtPaymentAllocation + RecurringOccurrence.paidAmount.
-- Debt names may repeat (two loans with the same lender kept apart).
-- Rollback: ../../../scripts/rollbacks/20261128090000_loan_containers.sql
BEGIN;

-- DropIndex
DROP INDEX "Debt_userId_name_key";

-- AlterTable
ALTER TABLE "RecurringOccurrence" ADD COLUMN "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DebtPaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DebtPaymentAllocation_occurrenceId_idx" ON "DebtPaymentAllocation"("occurrenceId");

-- CreateIndex
CREATE UNIQUE INDEX "DebtPaymentAllocation_paymentId_occurrenceId_key" ON "DebtPaymentAllocation"("paymentId", "occurrenceId");

-- AddForeignKey
ALTER TABLE "DebtPaymentAllocation" ADD CONSTRAINT "DebtPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "DebtPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPaymentAllocation" ADD CONSTRAINT "DebtPaymentAllocation_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "RecurringOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The first amount of each container, as a charge. Its installments only
-- when the loan is scheduled by its charges (purchase financing, personal
-- without a fixed payment) and it had a term, like financedCharges().
CREATE TEMP TABLE "_initial_amount" ON COMMIT DROP AS
SELECT
  d."id" AS "debtId",
  d."loanType" = 'purchase_financing'
    OR (d."loanType" = 'personal' AND d."installmentAmount" IS NULL) AS "byCharges",
  CASE
    WHEN (d."loanType" = 'purchase_financing'
          OR (d."loanType" = 'personal' AND d."installmentAmount" IS NULL))
      AND d."installmentsTotal" IS NOT NULL AND d."startDate" IS NOT NULL
    THEN d."installmentsTotal"
  END AS "installments"
FROM "Debt" d
WHERE d."kind" = 'loan'
  AND d."loanType" IN ('purchase_financing', 'personal')
  AND (d."principal" > 0 OR COALESCE(d."totalToRepay", 0) > 0);

INSERT INTO "DebtCharge" (
  "id", "debtId", "date", "description", "principal", "totalToRepay",
  "installments", "installmentsPaid", "firstPaymentDate", "interestMode",
  "interestRateAnnual", "includesVat", "destination", "depositAddsToBalance",
  "transactionId", "purposeCategoryId", "lendingMethod", "createdAt"
)
SELECT
  'initial-' || d."id",
  d."id",
  COALESCE(d."startDate", d."createdAt"::date),
  d."description",
  d."principal",
  COALESCE(d."totalToRepay", d."principal"),
  i."installments",
  0,
  NULL,
  CASE WHEN i."installments" IS NOT NULL THEN d."interestMode" END,
  CASE WHEN i."installments" IS NOT NULL AND d."interestMode" = 'rate' THEN d."interestRateAnnual" END,
  i."installments" IS NOT NULL AND d."interestMode" = 'rate' AND d."includesVat",
  COALESCE(
    d."destination",
    CASE WHEN d."loanType" = 'purchase_financing' THEN 'purchase' ELSE 'deposit' END::"DebtChargeDestination"
  ),
  d."depositAddsToBalance",
  d."disbursementTransactionId",
  d."purposeCategoryId",
  d."lendingMethod",
  d."createdAt"
FROM "Debt" d
JOIN "_initial_amount" i ON i."debtId" = d."id";

-- The container keeps only what is the loan's (name, lender, frequency,
-- schedule, a personal loan's agreed payment and its number of payments).
UPDATE "Debt" d
SET
  "principal" = 0,
  "totalToRepay" = NULL,
  "description" = NULL,
  "destination" = NULL,
  "depositAddsToBalance" = true,
  "disbursementTransactionId" = NULL,
  "purposeCategoryId" = NULL,
  "lendingMethod" = NULL,
  "installmentsTotal" = CASE WHEN i."byCharges" THEN NULL ELSE d."installmentsTotal" END,
  "interestMode" = CASE WHEN i."byCharges" THEN NULL ELSE d."interestMode" END,
  "interestRateAnnual" = CASE WHEN i."byCharges" THEN NULL ELSE d."interestRateAnnual" END,
  "includesVat" = CASE WHEN i."byCharges" THEN false ELSE d."includesVat" END,
  "updatedAt" = now()
FROM "_initial_amount" i
WHERE i."debtId" = d."id";

COMMIT;
