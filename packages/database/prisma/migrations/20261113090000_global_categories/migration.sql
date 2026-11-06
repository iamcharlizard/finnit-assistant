-- Global category catalog, category kind/icon/color, hidden categories and
-- the user's profile photo.
--
-- Until now every user got a copy of the starter categories. From here on
-- there is one global catalog (userId NULL, isDefault) shared by everyone
-- and kept in sync on start from apps/api/src/modules/auth/default-categories.ts;
-- users hide the ones they don't use (CategoryHidden) and keep their own.
-- This migration creates the catalog, points every reference of a user's
-- copy at the global category with the same key and deletes the copies.
-- Copies the user renamed (a translation with source 'user') or whose key
-- is no longer in the catalog stay as the user's own categories.
--
-- Rollback: packages/database/scripts/rollbacks/20261113090000_global_categories.sql
BEGIN;

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('expense', 'income');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "color" TEXT,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "kind" "CategoryKind" NOT NULL DEFAULT 'expense';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarKey" TEXT,
ADD COLUMN     "avatarUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "googlePictureUrl" TEXT;

-- CreateTable
CREATE TABLE "CategoryHidden" (
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryHidden_pkey" PRIMARY KEY ("userId","categoryId")
);

-- CreateIndex
CREATE INDEX "CategoryHidden_categoryId_idx" ON "CategoryHidden"("categoryId");

-- AddForeignKey
ALTER TABLE "CategoryHidden" ADD CONSTRAINT "CategoryHidden_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryHidden" ADD CONSTRAINT "CategoryHidden_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NULLs are distinct in (userId, key): a partial index keeps global keys unique.
CREATE UNIQUE INDEX "Category_global_key_key" ON "Category"("key") WHERE "userId" IS NULL;

-- The catalog: (key, parent key, English, Spanish, kind, icon, order).
CREATE TEMP TABLE category_catalog (
  key TEXT PRIMARY KEY,
  parent_key TEXT,
  name_en TEXT NOT NULL,
  name_es TEXT NOT NULL,
  kind "CategoryKind" NOT NULL,
  icon TEXT,
  sort_order INT NOT NULL
) ON COMMIT DROP;

INSERT INTO category_catalog (key, parent_key, name_en, name_es, kind, icon, sort_order) VALUES
  ('categories.housing', NULL, 'Housing', 'Vivienda', 'expense', 'housing', 1),
  ('categories.housing.rent', 'categories.housing', 'Rent', 'Renta', 'expense', NULL, 1),
  ('categories.housing.mortgage', 'categories.housing', 'Mortgage', 'Hipoteca', 'expense', NULL, 2),
  ('categories.housing.maintenance', 'categories.housing', 'HOA & Maintenance', 'Mantenimiento y cuotas', 'expense', NULL, 3),
  ('categories.housing.property_tax', 'categories.housing', 'Property Tax', 'Predial', 'expense', NULL, 4),
  ('categories.housing.repairs', 'categories.housing', 'Home Repairs', 'Reparaciones', 'expense', NULL, 5),
  ('categories.housing.furniture', 'categories.housing', 'Furniture & Home', 'Muebles y hogar', 'expense', NULL, 6),
  ('categories.bills.home_insurance', 'categories.housing', 'Home Insurance', 'Seguro de hogar', 'expense', 'insurance', 7),
  ('categories.bills', NULL, 'Bills & Utilities', 'Servicios', 'expense', 'bills', 2),
  ('categories.bills.electricity', 'categories.bills', 'Electricity', 'Luz', 'expense', NULL, 1),
  ('categories.bills.water', 'categories.bills', 'Water', 'Agua', 'expense', NULL, 2),
  ('categories.bills.home_gas', 'categories.bills', 'Home Gas', 'Gas doméstico', 'expense', NULL, 3),
  ('categories.bills.internet', 'categories.bills', 'Internet', 'Internet', 'expense', NULL, 4),
  ('categories.bills.phone', 'categories.bills', 'Phone', 'Teléfono', 'expense', NULL, 5),
  ('categories.food', NULL, 'Food & Dining', 'Comida y restaurantes', 'expense', 'food', 3),
  ('categories.food.groceries', 'categories.food', 'Groceries', 'Supermercado', 'expense', 'groceries', 1),
  ('categories.food.restaurants', 'categories.food', 'Restaurants', 'Restaurantes', 'expense', NULL, 2),
  ('categories.food.coffee_snacks', 'categories.food', 'Coffee & Snacks', 'Café y antojos', 'expense', 'coffee', 3),
  ('categories.food.delivery', 'categories.food', 'Food Delivery', 'Comida a domicilio', 'expense', NULL, 4),
  ('categories.transportation', NULL, 'Transportation', 'Transporte', 'expense', 'transport', 4),
  ('categories.transportation.gas', 'categories.transportation', 'Gas', 'Gasolina', 'expense', 'fuel', 1),
  ('categories.transportation.public_transit', 'categories.transportation', 'Public Transit', 'Transporte público', 'expense', NULL, 2),
  ('categories.transportation.rideshare', 'categories.transportation', 'Taxis & Rideshare', 'Taxis y apps', 'expense', NULL, 3),
  ('categories.transportation.parking', 'categories.transportation', 'Parking & Tolls', 'Estacionamiento y casetas', 'expense', NULL, 4),
  ('categories.transportation.car_maintenance', 'categories.transportation', 'Car Maintenance', 'Mantenimiento del auto', 'expense', NULL, 5),
  ('categories.transportation.car_insurance', 'categories.transportation', 'Car Insurance', 'Seguro de auto', 'expense', 'insurance', 6),
  ('categories.transportation.vehicle_taxes', 'categories.transportation', 'Vehicle Taxes & Inspection', 'Tenencia y verificación', 'expense', NULL, 7),
  ('categories.shopping', NULL, 'Shopping', 'Compras', 'expense', 'shopping', 5),
  ('categories.shopping.clothing', 'categories.shopping', 'Clothing & Shoes', 'Ropa y calzado', 'expense', NULL, 1),
  ('categories.shopping.electronics', 'categories.shopping', 'Electronics', 'Electrónica', 'expense', NULL, 2),
  ('categories.shopping.books', 'categories.shopping', 'Books', 'Libros', 'expense', NULL, 3),
  ('categories.shopping.general', 'categories.shopping', 'General', 'General', 'expense', NULL, 4),
  ('categories.health', NULL, 'Health & Medical', 'Salud', 'expense', 'health', 6),
  ('categories.health.doctor', 'categories.health', 'Doctor', 'Consultas médicas', 'expense', NULL, 1),
  ('categories.health.pharmacy', 'categories.health', 'Pharmacy', 'Farmacia', 'expense', NULL, 2),
  ('categories.health.dentist', 'categories.health', 'Dentist', 'Dentista', 'expense', NULL, 3),
  ('categories.health.fitness', 'categories.health', 'Fitness', 'Gimnasio y deporte', 'expense', NULL, 4),
  ('categories.health.health_insurance', 'categories.health', 'Health Insurance', 'Seguro de gastos médicos', 'expense', 'insurance', 5),
  ('categories.education', NULL, 'Education', 'Educación', 'expense', 'education', 7),
  ('categories.education.tuition', 'categories.education', 'Tuition', 'Colegiaturas', 'expense', NULL, 1),
  ('categories.education.textbooks', 'categories.education', 'Textbooks', 'Libros de texto', 'expense', NULL, 2),
  ('categories.education.supplies', 'categories.education', 'Supplies', 'Útiles escolares', 'expense', NULL, 3),
  ('categories.education.courses', 'categories.education', 'Courses', 'Cursos', 'expense', NULL, 4),
  ('categories.personal_care', NULL, 'Personal Care', 'Cuidado personal', 'expense', 'personal', 8),
  ('categories.personal_care.hair', 'categories.personal_care', 'Haircut', 'Corte de cabello', 'expense', NULL, 1),
  ('categories.personal_care.beauty', 'categories.personal_care', 'Beauty', 'Belleza', 'expense', NULL, 2),
  ('categories.personal_care.grooming', 'categories.personal_care', 'Grooming', 'Higiene y arreglo', 'expense', NULL, 3),
  ('categories.entertainment', NULL, 'Entertainment', 'Entretenimiento', 'expense', 'entertainment', 9),
  ('categories.entertainment.movies', 'categories.entertainment', 'Movies & Events', 'Cine y eventos', 'expense', NULL, 1),
  ('categories.entertainment.sports', 'categories.entertainment', 'Sports', 'Deportes', 'expense', NULL, 2),
  ('categories.entertainment.hobbies', 'categories.entertainment', 'Hobbies', 'Pasatiempos', 'expense', NULL, 3),
  ('categories.entertainment.going_out', 'categories.entertainment', 'Bars & Going Out', 'Bares y salidas', 'expense', NULL, 4),
  ('categories.subscriptions', NULL, 'Subscriptions', 'Suscripciones', 'expense', 'subscriptions', 10),
  ('categories.entertainment.subscriptions', 'categories.subscriptions', 'Streaming & Music', 'Streaming y música', 'expense', NULL, 1),
  ('categories.subscriptions.software', 'categories.subscriptions', 'Software & Apps', 'Software y apps', 'expense', NULL, 2),
  ('categories.subscriptions.memberships', 'categories.subscriptions', 'Memberships', 'Membresías', 'expense', NULL, 3),
  ('categories.travel', NULL, 'Travel', 'Viajes', 'expense', 'travel', 11),
  ('categories.travel.flights', 'categories.travel', 'Flights', 'Vuelos', 'expense', NULL, 1),
  ('categories.travel.lodging', 'categories.travel', 'Lodging', 'Hospedaje', 'expense', NULL, 2),
  ('categories.travel.activities', 'categories.travel', 'Travel Activities', 'Actividades', 'expense', NULL, 3),
  ('categories.family', NULL, 'Family & Pets', 'Familia y mascotas', 'expense', 'family', 12),
  ('categories.family.children', 'categories.family', 'Children', 'Hijos', 'expense', NULL, 1),
  ('categories.family.pets', 'categories.family', 'Pets', 'Mascotas', 'expense', 'pets', 2),
  ('categories.family.support', 'categories.family', 'Family Support', 'Apoyo familiar', 'expense', NULL, 3),
  ('categories.gifts', NULL, 'Gifts & Donations', 'Regalos y donativos', 'expense', 'gift', 13),
  ('categories.gifts.gifts', 'categories.gifts', 'Gifts', 'Regalos', 'expense', NULL, 1),
  ('categories.gifts.donations', 'categories.gifts', 'Donations', 'Donativos', 'expense', NULL, 2),
  ('categories.fees', NULL, 'Fees & Taxes', 'Comisiones e impuestos', 'expense', 'fees', 14),
  ('categories.fees.bank_fees', 'categories.fees', 'Bank Fees', 'Comisiones bancarias', 'expense', NULL, 1),
  ('categories.fees.interest', 'categories.fees', 'Interest Charges', 'Intereses', 'expense', NULL, 2),
  ('categories.fees.taxes', 'categories.fees', 'Taxes', 'Impuestos', 'expense', NULL, 3),
  ('categories.debts', NULL, 'Loans & Debts', 'Préstamos y deudas', 'expense', 'loan', 15),
  ('categories.debts.loan_payments', 'categories.debts', 'Loan Payments', 'Pago de préstamos', 'expense', NULL, 1),
  ('categories.debts.installment_payments', 'categories.debts', 'Installment Payments', 'Pagos a plazos', 'expense', NULL, 2),
  ('categories.uncategorized', NULL, 'Uncategorized', 'Sin categoría', 'expense', 'other', 16),
  ('categories.income', NULL, 'Income', 'Ingresos', 'income', 'income', 17),
  ('categories.income.salary', 'categories.income', 'Salary', 'Sueldo', 'income', NULL, 1),
  ('categories.income.freelance', 'categories.income', 'Freelance', 'Honorarios', 'income', NULL, 2),
  ('categories.income.business', 'categories.income', 'Business & Sales', 'Negocio y ventas', 'income', NULL, 3),
  ('categories.income.investments', 'categories.income', 'Investments & Interest', 'Inversiones e intereses', 'income', NULL, 4),
  ('categories.income.rental', 'categories.income', 'Rental Income', 'Rentas cobradas', 'income', NULL, 5),
  ('categories.income.refunds', 'categories.income', 'Refunds', 'Reembolsos', 'income', NULL, 6),
  ('categories.income.gifts_received', 'categories.income', 'Gifts Received', 'Regalos recibidos', 'income', NULL, 7),
  ('categories.income.other_income', 'categories.income', 'Other Income', 'Otros ingresos', 'income', NULL, 8)
;

-- Global rows: parents first, then children.
INSERT INTO "Category" ("id", "userId", "parentId", "name", "key", "isDefault", "kind", "icon", "sortOrder")
SELECT gen_random_uuid(), NULL, NULL, c.name_en, c.key, true, c.kind, c.icon, c.sort_order
FROM category_catalog c
WHERE c.parent_key IS NULL
ON CONFLICT ("key") WHERE "userId" IS NULL DO NOTHING;

INSERT INTO "Category" ("id", "userId", "parentId", "name", "key", "isDefault", "kind", "icon", "sortOrder")
SELECT gen_random_uuid(), NULL, p."id", c.name_en, c.key, true, c.kind, c.icon, c.sort_order
FROM category_catalog c
JOIN "Category" p ON p."userId" IS NULL AND p."key" = c.parent_key
WHERE c.parent_key IS NOT NULL
ON CONFLICT ("key") WHERE "userId" IS NULL DO NOTHING;

INSERT INTO "CategoryTranslation" ("id", "categoryId", "locale", "name", "source", "updatedAt")
SELECT gen_random_uuid(), g."id", t.locale, t.name, 'seed', CURRENT_TIMESTAMP
FROM category_catalog c
JOIN "Category" g ON g."userId" IS NULL AND g."key" = c.key
CROSS JOIN LATERAL (VALUES ('en', c.name_en), ('es', c.name_es)) AS t(locale, name)
ON CONFLICT ("categoryId", "locale") DO NOTHING;

-- Copies take the kind of their catalog entry (kept if they become own).
UPDATE "Category" c
SET "kind" = k.kind
FROM category_catalog k
WHERE c."userId" IS NOT NULL AND c."key" = k.key;

-- Copies the user renamed, or whose key left the catalog, become their own.
UPDATE "Category" c
SET "key" = NULL
WHERE c."userId" IS NOT NULL
  AND c."key" IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM "CategoryTranslation" t
      WHERE t."categoryId" = c."id" AND t."source" = 'user'
    )
    OR NOT EXISTS (SELECT 1 FROM category_catalog k WHERE k.key = c."key")
  );

-- Each remaining copy → the global category with its key.
CREATE TEMP TABLE category_remap ON COMMIT DROP AS
SELECT c."id" AS old_id, g."id" AS new_id
FROM "Category" c
JOIN "Category" g ON g."userId" IS NULL AND g."key" = c."key"
WHERE c."userId" IS NOT NULL;

UPDATE "Transaction" x SET "categoryId" = r.new_id FROM category_remap r WHERE x."categoryId" = r.old_id;
UPDATE "Transaction" x SET "suggestedCategoryId" = r.new_id FROM category_remap r WHERE x."suggestedCategoryId" = r.old_id;
UPDATE "BUDGET_CATEGORY" x SET "categoryId" = r.new_id FROM category_remap r WHERE x."categoryId" = r.old_id;
UPDATE "MerchantRule" x SET "categoryId" = r.new_id FROM category_remap r WHERE x."categoryId" = r.old_id;
UPDATE "MerchantAlias" x SET "categoryId" = r.new_id FROM category_remap r WHERE x."categoryId" = r.old_id;
UPDATE "MerchantTaxId" x SET "categoryId" = r.new_id FROM category_remap r WHERE x."categoryId" = r.old_id;
UPDATE "ReceiptImport" x SET "suggestedCategoryId" = r.new_id FROM category_remap r WHERE x."suggestedCategoryId" = r.old_id;
UPDATE "RecurringExpense" x SET "categoryId" = r.new_id FROM category_remap r WHERE x."categoryId" = r.old_id;
UPDATE "RecurringSuggestionState" x SET "aiCategoryId" = r.new_id FROM category_remap r WHERE x."aiCategoryId" = r.old_id;
UPDATE "Debt" x SET "purposeCategoryId" = r.new_id FROM category_remap r WHERE x."purposeCategoryId" = r.old_id;
UPDATE "DebtCharge" x SET "purposeCategoryId" = r.new_id FROM category_remap r WHERE x."purposeCategoryId" = r.old_id;
-- The user's own subcategories of a copy hang from the global parent now.
UPDATE "Category" x SET "parentId" = r.new_id FROM category_remap r WHERE x."parentId" = r.old_id;

DELETE FROM "Category" c USING category_remap r WHERE c."id" = r.old_id;

-- Own subcategories share their parent's kind.
UPDATE "Category" c
SET "kind" = 'income'
FROM "Category" p
WHERE c."userId" IS NOT NULL AND c."parentId" = p."id" AND p."kind" = 'income';

COMMIT;
