-- Default "Loans & Debts" category (loan and installment payments) for every
-- user, and the informative purpose category of a loan and of each charge.
-- Additive: two nullable columns and new category rows.
-- Rollback: ../../../scripts/rollbacks/20261102090000_debt_categories.sql
BEGIN;

ALTER TABLE "Debt" ADD COLUMN "purposeCategoryId" TEXT;
ALTER TABLE "DebtCharge" ADD COLUMN "purposeCategoryId" TEXT;

ALTER TABLE "Debt" ADD CONSTRAINT "Debt_purposeCategoryId_fkey" FOREIGN KEY ("purposeCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DebtCharge" ADD CONSTRAINT "DebtCharge_purposeCategoryId_fkey" FOREIGN KEY ("purposeCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: same names as apps/api/src/modules/auth/default-categories.ts.
-- It goes after Personal Care, so Income and Uncategorized move down one.
UPDATE "Category"
SET "sortOrder" = "sortOrder" + 1
WHERE "userId" IS NOT NULL
  AND "parentId" IS NULL
  AND "key" IN ('categories.income', 'categories.uncategorized')
  AND "sortOrder" IS NOT NULL;

INSERT INTO "Category" ("id", "userId", "name", "key", "isDefault", "sortOrder")
SELECT gen_random_uuid()::text, u."id", 'Loans & Debts', 'categories.debts', false, 9
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "Category" c
  WHERE c."userId" = u."id"
    AND (c."key" = 'categories.debts' OR c."name" = 'Loans & Debts')
);

INSERT INTO "Category" ("id", "userId", "parentId", "name", "key", "isDefault", "sortOrder")
SELECT gen_random_uuid()::text, p."userId", p."id", d."name", d."key", false, d."sort_order"
FROM "Category" p
CROSS JOIN (VALUES
  ('Loan Payments', 'categories.debts.loan_payments', 1),
  ('Installment Payments', 'categories.debts.installment_payments', 2)
) AS d("name", "key", "sort_order")
WHERE p."key" = 'categories.debts'
  AND p."userId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Category" c
    WHERE c."userId" = p."userId"
      AND (c."key" = d."key" OR c."name" = d."name")
  );

INSERT INTO "CategoryTranslation" ("id", "categoryId", "locale", "name", "source", "updatedAt")
SELECT gen_random_uuid()::text, c."id", t."locale", t."name", 'seed', CURRENT_TIMESTAMP
FROM "Category" c
JOIN (VALUES
  ('categories.debts', 'en', 'Loans & Debts'),
  ('categories.debts', 'es', 'Préstamos y deudas'),
  ('categories.debts.loan_payments', 'en', 'Loan Payments'),
  ('categories.debts.loan_payments', 'es', 'Pago de préstamos'),
  ('categories.debts.installment_payments', 'en', 'Installment Payments'),
  ('categories.debts.installment_payments', 'es', 'Pagos a plazos')
) AS t("key", "locale", "name") ON t."key" = c."key"
WHERE c."userId" IS NOT NULL
ON CONFLICT ("categoryId", "locale") DO NOTHING;

COMMIT;
