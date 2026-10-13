import type { PrismaClient, Prisma } from '@finnit/database';

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

export interface DefaultCategoryName {
  /** i18n key, e.g. `categories.food.groceries`. */
  key: string;
  /** English original, stored in Category.name. */
  en: string;
  /** Mexican Spanish. */
  es: string;
}

export interface DefaultCategory extends DefaultCategoryName {
  children: DefaultCategoryName[];
}

const child = (
  parent: string,
  slug: string,
  en: string,
  es: string,
): DefaultCategoryName => ({ key: `categories.${parent}.${slug}`, en, es });

/**
 * Starter categories every new user gets. English names must be unique per
 * user (category_user_name_unique), including children across parents.
 * Migration 20261015090000_category_i18n_and_ai_features keys existing
 * users' categories with this same list: keep them in sync.
 */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Expenses
  {
    key: 'categories.food',
    en: 'Food & Dining',
    es: 'Comida y restaurantes',
    children: [
      child('food', 'groceries', 'Groceries', 'Supermercado'),
      child('food', 'restaurants', 'Restaurants', 'Restaurantes'),
      child('food', 'coffee_snacks', 'Coffee & Snacks', 'Café y antojos'),
    ],
  },
  {
    key: 'categories.transportation',
    en: 'Transportation',
    es: 'Transporte',
    children: [
      child('transportation', 'gas', 'Gas', 'Gasolina'),
      child(
        'transportation',
        'public_transit',
        'Public Transit',
        'Transporte público',
      ),
      child('transportation', 'parking', 'Parking', 'Estacionamiento'),
      child(
        'transportation',
        'car_maintenance',
        'Car Maintenance',
        'Mantenimiento del auto',
      ),
    ],
  },
  {
    key: 'categories.shopping',
    en: 'Shopping',
    es: 'Compras',
    children: [
      child('shopping', 'clothing', 'Clothing', 'Ropa'),
      child('shopping', 'electronics', 'Electronics', 'Electrónica'),
      child('shopping', 'books', 'Books', 'Libros'),
      child('shopping', 'general', 'General', 'General'),
    ],
  },
  {
    key: 'categories.bills',
    en: 'Bills & Utilities',
    es: 'Servicios',
    children: [
      child('bills', 'electricity', 'Electricity', 'Luz'),
      child('bills', 'water', 'Water', 'Agua'),
      child('bills', 'internet', 'Internet', 'Internet'),
      child('bills', 'phone', 'Phone', 'Teléfono'),
      child('bills', 'home_insurance', 'Home Insurance', 'Seguro de casa'),
    ],
  },
  {
    key: 'categories.entertainment',
    en: 'Entertainment',
    es: 'Entretenimiento',
    children: [
      child('entertainment', 'movies', 'Movies', 'Cine'),
      child('entertainment', 'sports', 'Sports', 'Deportes'),
      child('entertainment', 'hobbies', 'Hobbies', 'Pasatiempos'),
      child('entertainment', 'subscriptions', 'Subscriptions', 'Suscripciones'),
    ],
  },
  {
    key: 'categories.health',
    en: 'Health & Medical',
    es: 'Salud',
    children: [
      child('health', 'doctor', 'Doctor', 'Médico'),
      child('health', 'pharmacy', 'Pharmacy', 'Farmacia'),
      child('health', 'fitness', 'Fitness', 'Gimnasio'),
      child(
        'health',
        'health_insurance',
        'Health Insurance',
        'Seguro de gastos médicos',
      ),
    ],
  },
  {
    key: 'categories.education',
    en: 'Education',
    es: 'Educación',
    children: [
      child('education', 'tuition', 'Tuition', 'Colegiaturas'),
      child('education', 'textbooks', 'Textbooks', 'Libros de texto'),
      child('education', 'supplies', 'Supplies', 'Útiles escolares'),
    ],
  },
  {
    key: 'categories.personal_care',
    en: 'Personal Care',
    es: 'Cuidado personal',
    children: [
      child('personal_care', 'hair', 'Hair', 'Cabello'),
      child('personal_care', 'beauty', 'Beauty', 'Belleza'),
      child('personal_care', 'grooming', 'Grooming', 'Arreglo personal'),
    ],
  },

  // Income
  {
    key: 'categories.income',
    en: 'Income',
    es: 'Ingresos',
    children: [
      child('income', 'salary', 'Salary', 'Sueldo'),
      child('income', 'freelance', 'Freelance', 'Trabajo independiente'),
      child('income', 'investments', 'Investments', 'Inversiones'),
      child('income', 'other_income', 'Other Income', 'Otros ingresos'),
    ],
  },

  // Other
  {
    key: 'categories.uncategorized',
    en: 'Uncategorized',
    es: 'Sin categoría',
    children: [],
  },
];

function seedTranslations(name: DefaultCategoryName) {
  return {
    create: [
      { locale: 'en', name: name.en, source: 'seed' as const },
      { locale: 'es', name: name.es, source: 'seed' as const },
    ],
  };
}

/**
 * Creates the starter categories (with their key and en/es names). With
 * `skipExisting`, skips the ones the user already has (same key or same
 * English name), so it can run again for an existing user.
 */
export async function createDefaultCategories(
  prisma: PrismaClientLike,
  userId: string,
  options: { skipExisting?: boolean } = {},
): Promise<void> {
  const existing = options.skipExisting
    ? await prisma.category.findMany({
        where: { userId },
        select: { id: true, key: true, name: true },
      })
    : [];
  const find = (name: DefaultCategoryName) =>
    existing.find((row) => row.key === name.key || row.name === name.en);

  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const parent = DEFAULT_CATEGORIES[i];
    const parentId =
      find(parent)?.id ??
      (
        await prisma.category.create({
          data: {
            userId,
            key: parent.key,
            name: parent.en,
            sortOrder: i + 1,
            isDefault: false,
            translations: seedTranslations(parent),
          },
        })
      ).id;

    for (let j = 0; j < parent.children.length; j++) {
      const name = parent.children[j];
      if (find(name)) continue;
      await prisma.category.create({
        data: {
          userId,
          parentId,
          key: name.key,
          name: name.en,
          sortOrder: j + 1,
          isDefault: false,
          translations: seedTranslations(name),
        },
      });
    }
  }
}
