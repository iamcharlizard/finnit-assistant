-- Category i18n (key + per-locale names), user locale, new AI feature keys.
-- Existing default categories get their key and seed es/en names.
-- The AiFeature rows for the new keys are inserted by the next migration
-- (20261015090100_ai_feature_defaults): a value added with
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction.
-- Rollback: ../../../scripts/rollbacks/20261015090000_category_i18n_and_ai_features.sql
BEGIN;

-- CreateEnum
CREATE TYPE "TranslationSource" AS ENUM ('seed', 'google', 'ai', 'user');

-- AlterEnum (allowed inside a transaction block since PostgreSQL 12)
ALTER TYPE "AiFeatureKey" ADD VALUE 'transaction_categorization';
ALTER TYPE "AiFeatureKey" ADD VALUE 'recurring_classification';
ALTER TYPE "AiFeatureKey" ADD VALUE 'receipt_parsing';
ALTER TYPE "AiFeatureKey" ADD VALUE 'translation';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "key" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locale" VARCHAR(5) NOT NULL DEFAULT 'es';

-- CreateTable
CREATE TABLE "CategoryTranslation" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "name" TEXT NOT NULL,
    "source" "TranslationSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryTranslation_categoryId_locale_key" ON "CategoryTranslation"("categoryId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_key_key" ON "Category"("userId", "key");

-- AddForeignKey
ALTER TABLE "CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: default categories (same list as apps/api/src/modules/auth/default-categories.ts).
-- They were created with isDefault = false, so match by English name + parent.
CREATE TEMPORARY TABLE "_default_category" (
  "parent_name" TEXT,
  "name" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name_es" TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO "_default_category" ("parent_name", "name", "key", "name_es") VALUES
  (NULL, 'Food & Dining', 'categories.food', 'Comida y restaurantes'),
  ('Food & Dining', 'Groceries', 'categories.food.groceries', 'Supermercado'),
  ('Food & Dining', 'Restaurants', 'categories.food.restaurants', 'Restaurantes'),
  ('Food & Dining', 'Coffee & Snacks', 'categories.food.coffee_snacks', 'Café y antojos'),
  (NULL, 'Transportation', 'categories.transportation', 'Transporte'),
  ('Transportation', 'Gas', 'categories.transportation.gas', 'Gasolina'),
  ('Transportation', 'Public Transit', 'categories.transportation.public_transit', 'Transporte público'),
  ('Transportation', 'Parking', 'categories.transportation.parking', 'Estacionamiento'),
  ('Transportation', 'Car Maintenance', 'categories.transportation.car_maintenance', 'Mantenimiento del auto'),
  (NULL, 'Shopping', 'categories.shopping', 'Compras'),
  ('Shopping', 'Clothing', 'categories.shopping.clothing', 'Ropa'),
  ('Shopping', 'Electronics', 'categories.shopping.electronics', 'Electrónica'),
  ('Shopping', 'Books', 'categories.shopping.books', 'Libros'),
  ('Shopping', 'General', 'categories.shopping.general', 'General'),
  (NULL, 'Bills & Utilities', 'categories.bills', 'Servicios'),
  ('Bills & Utilities', 'Electricity', 'categories.bills.electricity', 'Luz'),
  ('Bills & Utilities', 'Water', 'categories.bills.water', 'Agua'),
  ('Bills & Utilities', 'Internet', 'categories.bills.internet', 'Internet'),
  ('Bills & Utilities', 'Phone', 'categories.bills.phone', 'Teléfono'),
  ('Bills & Utilities', 'Home Insurance', 'categories.bills.home_insurance', 'Seguro de casa'),
  (NULL, 'Entertainment', 'categories.entertainment', 'Entretenimiento'),
  ('Entertainment', 'Movies', 'categories.entertainment.movies', 'Cine'),
  ('Entertainment', 'Sports', 'categories.entertainment.sports', 'Deportes'),
  ('Entertainment', 'Hobbies', 'categories.entertainment.hobbies', 'Pasatiempos'),
  ('Entertainment', 'Subscriptions', 'categories.entertainment.subscriptions', 'Suscripciones'),
  (NULL, 'Health & Medical', 'categories.health', 'Salud'),
  ('Health & Medical', 'Doctor', 'categories.health.doctor', 'Médico'),
  ('Health & Medical', 'Pharmacy', 'categories.health.pharmacy', 'Farmacia'),
  ('Health & Medical', 'Fitness', 'categories.health.fitness', 'Gimnasio'),
  ('Health & Medical', 'Health Insurance', 'categories.health.health_insurance', 'Seguro de gastos médicos'),
  (NULL, 'Education', 'categories.education', 'Educación'),
  ('Education', 'Tuition', 'categories.education.tuition', 'Colegiaturas'),
  ('Education', 'Textbooks', 'categories.education.textbooks', 'Libros de texto'),
  ('Education', 'Supplies', 'categories.education.supplies', 'Útiles escolares'),
  (NULL, 'Personal Care', 'categories.personal_care', 'Cuidado personal'),
  ('Personal Care', 'Hair', 'categories.personal_care.hair', 'Cabello'),
  ('Personal Care', 'Beauty', 'categories.personal_care.beauty', 'Belleza'),
  ('Personal Care', 'Grooming', 'categories.personal_care.grooming', 'Arreglo personal'),
  (NULL, 'Income', 'categories.income', 'Ingresos'),
  ('Income', 'Salary', 'categories.income.salary', 'Sueldo'),
  ('Income', 'Freelance', 'categories.income.freelance', 'Trabajo independiente'),
  ('Income', 'Investments', 'categories.income.investments', 'Inversiones'),
  ('Income', 'Other Income', 'categories.income.other_income', 'Otros ingresos'),
  (NULL, 'Uncategorized', 'categories.uncategorized', 'Sin categoría')
;

-- Root categories
UPDATE "Category" c
SET "key" = d."key"
FROM "_default_category" d
WHERE d."parent_name" IS NULL
  AND c."parentId" IS NULL
  AND c."userId" IS NOT NULL
  AND c."name" = d."name";

-- Subcategories (parent with the default English name)
UPDATE "Category" c
SET "key" = d."key"
FROM "_default_category" d, "Category" p
WHERE d."parent_name" IS NOT NULL
  AND c."parentId" = p."id"
  AND c."userId" IS NOT NULL
  AND p."userId" = c."userId"
  AND p."name" = d."parent_name"
  AND c."name" = d."name";

INSERT INTO "CategoryTranslation" ("id", "categoryId", "locale", "name", "source", "updatedAt")
SELECT gen_random_uuid()::text, c."id", t."locale", t."name", 'seed', CURRENT_TIMESTAMP
FROM "Category" c
JOIN "_default_category" d ON d."key" = c."key"
CROSS JOIN LATERAL (VALUES ('en', d."name"), ('es', d."name_es")) AS t("locale", "name")
ON CONFLICT ("categoryId", "locale") DO NOTHING;

COMMIT;
