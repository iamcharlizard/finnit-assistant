-- Each movement records what it did to its account's balance, signed, so
-- the balance of any past day can be worked out (current balance minus the
-- effects dated after that day). Additive: one nullable column, filled for
-- existing movements:
--   income +amount, expense −amount, transfer −/+ by its side, signed
--   balance updates (negative amount) keep their sign (the amount becomes
--   positive), loan deposits and imported adjustments (card payments,
--   refunds) add. Other manual adjustments (opening balances, older balance
--   adjustments) don't store their direction: when an account has only one,
--   it takes the sign that makes the account's effects add up to its
--   current balance; otherwise it stays null.
-- Rollback: ../../../scripts/rollbacks/20261109090000_transaction_balance_effect.sql
BEGIN;
ALTER TABLE "Transaction" ADD COLUMN "balanceEffect" DECIMAL(18,2);

UPDATE "Transaction" SET "balanceEffect" = "amount" WHERE "type" = 'income';
UPDATE "Transaction" SET "balanceEffect" = -"amount" WHERE "type" = 'expense';

UPDATE "Transaction" t SET "balanceEffect" = -t."amount"
FROM "Transfer" tr WHERE tr."fromTxnId" = t."id";
UPDATE "Transaction" t SET "balanceEffect" = t."amount"
FROM "Transfer" tr WHERE tr."toTxnId" = t."id";

UPDATE "Transaction" SET "balanceEffect" = "amount", "amount" = -"amount"
WHERE "type" = 'adjustment' AND "amount" < 0;

UPDATE "Transaction" t SET "balanceEffect" = t."amount"
WHERE t."type" = 'adjustment' AND t."balanceEffect" IS NULL
  AND (EXISTS (SELECT 1 FROM "DebtCharge" c WHERE c."transactionId" = t."id")
    OR EXISTS (SELECT 1 FROM "Debt" d WHERE d."disbursementTransactionId" = t."id")
    OR t."source" <> 'manual');

WITH known AS (
  SELECT "accountId", SUM("balanceEffect") FILTER (WHERE NOT "isPending") AS total
  FROM "Transaction" GROUP BY "accountId"
), ambiguous AS (
  SELECT "accountId", MIN("id") AS id, COUNT(*) AS n
  FROM "Transaction"
  WHERE "type" = 'adjustment' AND "balanceEffect" IS NULL
  GROUP BY "accountId"
)
UPDATE "Transaction" t
SET "balanceEffect" = CASE
  WHEN abs(a."balanceCurrent" - COALESCE(k.total, 0) - t."amount")
    <= abs(a."balanceCurrent" - COALESCE(k.total, 0) + t."amount")
  THEN t."amount" ELSE -t."amount" END
FROM ambiguous m
JOIN "Account" a ON a."id" = m."accountId"
LEFT JOIN known k ON k."accountId" = m."accountId"
WHERE m.n = 1 AND t."id" = m.id;
COMMIT;
