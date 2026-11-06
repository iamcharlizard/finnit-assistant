-- Rollback for migration 20261113090000_global_categories.
-- Gives every user their own copy of each global category again (same key,
-- names and tree, isDefault false as before), points every reference of a
-- global category at the user's copy, then deletes the global catalog.
-- Loses: hidden categories, category kind/icon/color and profile photos
-- (the uploaded files stay in S3 under users/<id>/avatars/).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261113090000_global_categories.sql

BEGIN;

-- 1. One copy per user and global category (parents first).
INSERT INTO "Category" ("id", "userId", "parentId", "name", "key", "isDefault", "sortOrder")
SELECT gen_random_uuid(), u."id", NULL, g."name", g."key", false, g."sortOrder"
FROM "User" u
CROSS JOIN "Category" g
WHERE g."userId" IS NULL AND g."parentId" IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "Category" ("id", "userId", "parentId", "name", "key", "isDefault", "sortOrder")
SELECT gen_random_uuid(), u."id", pc."id", g."name", g."key", false, g."sortOrder"
FROM "User" u
CROSS JOIN "Category" g
JOIN "Category" gp ON gp."id" = g."parentId"
JOIN "Category" pc ON pc."userId" = u."id" AND pc."key" = gp."key"
WHERE g."userId" IS NULL AND g."parentId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- (user, global) → the user's copy.
CREATE TEMP TABLE category_unmap ON COMMIT DROP AS
SELECT u."id" AS user_id, g."id" AS global_id, c."id" AS copy_id
FROM "User" u
CROSS JOIN "Category" g
JOIN "Category" c ON c."userId" = u."id" AND (c."key" = g."key" OR (c."key" IS NULL AND c."name" = g."name"))
WHERE g."userId" IS NULL;

INSERT INTO "CategoryTranslation" ("id", "categoryId", "locale", "name", "source", "updatedAt")
SELECT gen_random_uuid(), m.copy_id, t."locale", t."name", t."source", CURRENT_TIMESTAMP
FROM category_unmap m
JOIN "CategoryTranslation" t ON t."categoryId" = m.global_id
ON CONFLICT ("categoryId", "locale") DO NOTHING;

-- 2. References → the copy of their owner.
UPDATE "Transaction" x SET "categoryId" = m.copy_id FROM category_unmap m WHERE x."categoryId" = m.global_id AND x."userId" = m.user_id;
UPDATE "Transaction" x SET "suggestedCategoryId" = m.copy_id FROM category_unmap m WHERE x."suggestedCategoryId" = m.global_id AND x."userId" = m.user_id;
UPDATE "BUDGET_CATEGORY" x SET "categoryId" = m.copy_id FROM "Budget" b, category_unmap m WHERE x."budgetId" = b."id" AND x."categoryId" = m.global_id AND b."userId" = m.user_id;
UPDATE "MerchantRule" x SET "categoryId" = m.copy_id FROM category_unmap m WHERE x."categoryId" = m.global_id AND x."userId" = m.user_id;
UPDATE "MerchantAlias" x SET "categoryId" = m.copy_id FROM category_unmap m WHERE x."categoryId" = m.global_id AND x."userId" = m.user_id;
UPDATE "MerchantTaxId" x SET "categoryId" = m.copy_id FROM category_unmap m WHERE x."categoryId" = m.global_id AND x."userId" = m.user_id;
UPDATE "ReceiptImport" x SET "suggestedCategoryId" = m.copy_id FROM category_unmap m WHERE x."suggestedCategoryId" = m.global_id AND x."userId" = m.user_id;
UPDATE "RecurringExpense" x SET "categoryId" = m.copy_id FROM category_unmap m WHERE x."categoryId" = m.global_id AND x."userId" = m.user_id;
UPDATE "RecurringSuggestionState" x SET "aiCategoryId" = m.copy_id FROM category_unmap m WHERE x."aiCategoryId" = m.global_id AND x."userId" = m.user_id;
UPDATE "Debt" x SET "purposeCategoryId" = m.copy_id FROM category_unmap m WHERE x."purposeCategoryId" = m.global_id AND x."userId" = m.user_id;
UPDATE "DebtCharge" x SET "purposeCategoryId" = m.copy_id FROM "Debt" d, category_unmap m WHERE x."debtId" = d."id" AND x."purposeCategoryId" = m.global_id AND d."userId" = m.user_id;
UPDATE "Category" x SET "parentId" = m.copy_id FROM category_unmap m WHERE x."parentId" = m.global_id AND x."userId" = m.user_id;

-- 3. The global catalog goes away (global tax ids lose their category).
UPDATE "MerchantTaxId" SET "categoryId" = NULL
WHERE "categoryId" IN (SELECT "id" FROM "Category" WHERE "userId" IS NULL);
DROP TABLE IF EXISTS "CategoryHidden";
DELETE FROM "Category" WHERE "userId" IS NULL;

DROP INDEX IF EXISTS "Category_global_key_key";
ALTER TABLE "Category" DROP COLUMN IF EXISTS "kind";
ALTER TABLE "Category" DROP COLUMN IF EXISTS "icon";
ALTER TABLE "Category" DROP COLUMN IF EXISTS "color";
DROP TYPE IF EXISTS "CategoryKind";

ALTER TABLE "User" DROP COLUMN IF EXISTS "googlePictureUrl";
ALTER TABLE "User" DROP COLUMN IF EXISTS "avatarKey";
ALTER TABLE "User" DROP COLUMN IF EXISTS "avatarUpdatedAt";

DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261113090000_global_categories';

COMMIT;
