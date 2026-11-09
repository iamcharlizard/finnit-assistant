-- Every MSI plan (recurring expense of kind installment with a number of
-- installments, on a credit card, not linked to a debt) becomes a debt of
-- loan type card_installments: the whole amount is installment ×
-- installments, without interest, bought a month before its first
-- installment. The plan becomes the debt's schedule, and its paid
-- installments its payments (with their movement when they have one).
-- A name already used by another debt gets the card's name after it.
-- Rollback: ../../../scripts/rollbacks/20261121090000_card_installments.sql
BEGIN;

CREATE TEMP TABLE "_msi_plan" ON COMMIT DROP AS
SELECT
  re."id" AS "expenseId",
  gen_random_uuid()::text AS "debtId",
  re."userId",
  CASE
    WHEN EXISTS (
      SELECT 1 FROM "Debt" d WHERE d."userId" = re."userId" AND d."name" = re."name"
    ) OR EXISTS (
      SELECT 1 FROM "RecurringExpense" o
      WHERE o."userId" = re."userId" AND o."name" = re."name" AND o."id" < re."id"
        AND o."kind" = 'installment' AND o."debtId" IS NULL
    )
    THEN re."name" || ' (' || a."name" || ' ' || left(re."id", 4) || ')'
    ELSE re."name"
  END AS "name",
  re."accountId",
  re."amount",
  re."installmentsTotal",
  re."installmentsPaid",
  re."startDate"
FROM "RecurringExpense" re
JOIN "Account" a ON a."id" = re."accountId"
WHERE re."kind" = 'installment'
  AND re."debtId" IS NULL
  AND re."installmentsTotal" IS NOT NULL
  AND a."type" = 'credit';

INSERT INTO "Debt" (
  "id", "userId", "name", "kind", "principal", "minPaymentAmount",
  "startDate", "linkedAccountId", "loanType", "status", "paymentFrequency",
  "installmentsTotal", "installmentAmount", "totalToRepay", "destination",
  "createdAt", "updatedAt"
)
SELECT
  p."debtId", p."userId", p."name", 'loan',
  round(p."amount" * p."installmentsTotal", 2), p."amount",
  (p."startDate" - interval '1 month')::date, p."accountId",
  'card_installments',
  CASE WHEN p."installmentsPaid" >= p."installmentsTotal" THEN 'paid_off' ELSE 'active' END::"DebtStatus",
  'monthly', p."installmentsTotal", p."amount",
  round(p."amount" * p."installmentsTotal", 2), 'purchase',
  now(), now()
FROM "_msi_plan" p;

UPDATE "RecurringExpense" re
SET "debtId" = p."debtId"
FROM "_msi_plan" p
WHERE re."id" = p."expenseId";

-- Paid installments: with their movement unless it already pays a debt.
INSERT INTO "DebtPayment" ("id", "debtId", "transactionId", "isHistorical", "amount", "date")
SELECT
  gen_random_uuid()::text,
  p."debtId",
  CASE WHEN dp."id" IS NULL THEN o."transactionId" END,
  (o."transactionId" IS NULL OR dp."id" IS NOT NULL),
  COALESCE(t."amount", o."expectedAmount"),
  o."dueDate"
FROM "_msi_plan" p
JOIN "RecurringOccurrence" o ON o."recurringExpenseId" = p."expenseId" AND o."status" = 'paid'
LEFT JOIN "Transaction" t ON t."id" = o."transactionId"
LEFT JOIN "DebtPayment" dp ON dp."transactionId" = o."transactionId";

COMMIT;
