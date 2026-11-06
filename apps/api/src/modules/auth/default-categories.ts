import type { PrismaClient, Prisma } from '@finnit/database';
import { CategoryKind, TranslationSource } from '@finnit/database';

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

export interface DefaultCategoryName {
  /** i18n key, e.g. `categories.food.groceries`. Never changes once shipped. */
  key: string;
  /** English original, stored in Category.name. */
  en: string;
  /** Mexican Spanish. */
  es: string;
  /** Icon key the clients know (see the web's CATEGORY_ICONS); children without one use their parent's. */
  icon?: string;
}

export interface DefaultCategory extends DefaultCategoryName {
  kind: CategoryKind;
  icon: string;
  children: DefaultCategoryName[];
}

const child = (
  parent: string,
  slug: string,
  en: string,
  es: string,
  icon?: string,
): DefaultCategoryName => ({
  key: `categories.${parent}.${slug}`,
  en,
  es,
  ...(icon && { icon }),
});

const expense = CategoryKind.expense;

/**
 * The global category catalog: one shared set of categories (userId null,
 * isDefault) that every user sees and nobody edits; users hide the ones
 * they don't use and add their own. CategoryCatalogService upserts it by
 * key when the API starts, so curating it means editing this list: keys
 * never change or go away (movements point at them), names, icons, order
 * and parent can. A key's parent is the entry it is listed under, which is
 * why `categories.bills.home_insurance` lives under Housing.
 */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Expenses
  {
    key: 'categories.housing',
    en: 'Housing',
    es: 'Vivienda',
    kind: expense,
    icon: 'housing',
    children: [
      child('housing', 'rent', 'Rent', 'Renta'),
      child('housing', 'mortgage', 'Mortgage', 'Hipoteca'),
      child(
        'housing',
        'maintenance',
        'HOA & Maintenance',
        'Mantenimiento y cuotas',
      ),
      child('housing', 'property_tax', 'Property Tax', 'Predial'),
      child('housing', 'repairs', 'Home Repairs', 'Reparaciones'),
      child('housing', 'furniture', 'Furniture & Home', 'Muebles y hogar'),
      child(
        'bills',
        'home_insurance',
        'Home Insurance',
        'Seguro de hogar',
        'insurance',
      ),
    ],
  },
  {
    key: 'categories.bills',
    en: 'Bills & Utilities',
    es: 'Servicios',
    kind: expense,
    icon: 'bills',
    children: [
      child('bills', 'electricity', 'Electricity', 'Luz'),
      child('bills', 'water', 'Water', 'Agua'),
      child('bills', 'home_gas', 'Home Gas', 'Gas doméstico'),
      child('bills', 'internet', 'Internet', 'Internet'),
      child('bills', 'phone', 'Phone', 'Teléfono'),
    ],
  },
  {
    key: 'categories.food',
    en: 'Food & Dining',
    es: 'Comida y restaurantes',
    kind: expense,
    icon: 'food',
    children: [
      child('food', 'groceries', 'Groceries', 'Supermercado', 'groceries'),
      child('food', 'restaurants', 'Restaurants', 'Restaurantes'),
      child(
        'food',
        'coffee_snacks',
        'Coffee & Snacks',
        'Café y antojos',
        'coffee',
      ),
      child('food', 'delivery', 'Food Delivery', 'Comida a domicilio'),
    ],
  },
  {
    key: 'categories.transportation',
    en: 'Transportation',
    es: 'Transporte',
    kind: expense,
    icon: 'transport',
    children: [
      child('transportation', 'gas', 'Gas', 'Gasolina', 'fuel'),
      child(
        'transportation',
        'public_transit',
        'Public Transit',
        'Transporte público',
      ),
      child('transportation', 'rideshare', 'Taxis & Rideshare', 'Taxis y apps'),
      child(
        'transportation',
        'parking',
        'Parking & Tolls',
        'Estacionamiento y casetas',
      ),
      child(
        'transportation',
        'car_maintenance',
        'Car Maintenance',
        'Mantenimiento del auto',
      ),
      child(
        'transportation',
        'car_insurance',
        'Car Insurance',
        'Seguro de auto',
        'insurance',
      ),
      child(
        'transportation',
        'vehicle_taxes',
        'Vehicle Taxes & Inspection',
        'Tenencia y verificación',
      ),
    ],
  },
  {
    key: 'categories.shopping',
    en: 'Shopping',
    es: 'Compras',
    kind: expense,
    icon: 'shopping',
    children: [
      child('shopping', 'clothing', 'Clothing & Shoes', 'Ropa y calzado'),
      child('shopping', 'electronics', 'Electronics', 'Electrónica'),
      child('shopping', 'books', 'Books', 'Libros'),
      child('shopping', 'general', 'General', 'General'),
    ],
  },
  {
    key: 'categories.health',
    en: 'Health & Medical',
    es: 'Salud',
    kind: expense,
    icon: 'health',
    children: [
      child('health', 'doctor', 'Doctor', 'Consultas médicas'),
      child('health', 'pharmacy', 'Pharmacy', 'Farmacia'),
      child('health', 'dentist', 'Dentist', 'Dentista'),
      child('health', 'fitness', 'Fitness', 'Gimnasio y deporte'),
      child(
        'health',
        'health_insurance',
        'Health Insurance',
        'Seguro de gastos médicos',
        'insurance',
      ),
    ],
  },
  {
    key: 'categories.education',
    en: 'Education',
    es: 'Educación',
    kind: expense,
    icon: 'education',
    children: [
      child('education', 'tuition', 'Tuition', 'Colegiaturas'),
      child('education', 'textbooks', 'Textbooks', 'Libros de texto'),
      child('education', 'supplies', 'Supplies', 'Útiles escolares'),
      child('education', 'courses', 'Courses', 'Cursos'),
    ],
  },
  {
    key: 'categories.personal_care',
    en: 'Personal Care',
    es: 'Cuidado personal',
    kind: expense,
    icon: 'personal',
    children: [
      child('personal_care', 'hair', 'Haircut', 'Corte de cabello'),
      child('personal_care', 'beauty', 'Beauty', 'Belleza'),
      child('personal_care', 'grooming', 'Grooming', 'Higiene y arreglo'),
    ],
  },
  {
    key: 'categories.entertainment',
    en: 'Entertainment',
    es: 'Entretenimiento',
    kind: expense,
    icon: 'entertainment',
    children: [
      child('entertainment', 'movies', 'Movies & Events', 'Cine y eventos'),
      child('entertainment', 'sports', 'Sports', 'Deportes'),
      child('entertainment', 'hobbies', 'Hobbies', 'Pasatiempos'),
      child(
        'entertainment',
        'going_out',
        'Bars & Going Out',
        'Bares y salidas',
      ),
    ],
  },
  {
    key: 'categories.subscriptions',
    en: 'Subscriptions',
    es: 'Suscripciones',
    kind: expense,
    icon: 'subscriptions',
    children: [
      child(
        'entertainment',
        'subscriptions',
        'Streaming & Music',
        'Streaming y música',
      ),
      child('subscriptions', 'software', 'Software & Apps', 'Software y apps'),
      child('subscriptions', 'memberships', 'Memberships', 'Membresías'),
    ],
  },
  {
    key: 'categories.travel',
    en: 'Travel',
    es: 'Viajes',
    kind: expense,
    icon: 'travel',
    children: [
      child('travel', 'flights', 'Flights', 'Vuelos'),
      child('travel', 'lodging', 'Lodging', 'Hospedaje'),
      child('travel', 'activities', 'Travel Activities', 'Actividades'),
    ],
  },
  {
    key: 'categories.family',
    en: 'Family & Pets',
    es: 'Familia y mascotas',
    kind: expense,
    icon: 'family',
    children: [
      child('family', 'children', 'Children', 'Hijos'),
      child('family', 'pets', 'Pets', 'Mascotas', 'pets'),
      child('family', 'support', 'Family Support', 'Apoyo familiar'),
    ],
  },
  {
    key: 'categories.gifts',
    en: 'Gifts & Donations',
    es: 'Regalos y donativos',
    kind: expense,
    icon: 'gift',
    children: [
      child('gifts', 'gifts', 'Gifts', 'Regalos'),
      child('gifts', 'donations', 'Donations', 'Donativos'),
    ],
  },
  {
    key: 'categories.fees',
    en: 'Fees & Taxes',
    es: 'Comisiones e impuestos',
    kind: expense,
    icon: 'fees',
    children: [
      child('fees', 'bank_fees', 'Bank Fees', 'Comisiones bancarias'),
      child('fees', 'interest', 'Interest Charges', 'Intereses'),
      child('fees', 'taxes', 'Taxes', 'Impuestos'),
    ],
  },
  // Payments of loans, purchase financing and MSI (the default category of
  // their payments; see debtPaymentCategoryKey).
  {
    key: 'categories.debts',
    en: 'Loans & Debts',
    es: 'Préstamos y deudas',
    kind: expense,
    icon: 'loan',
    children: [
      child('debts', 'loan_payments', 'Loan Payments', 'Pago de préstamos'),
      child(
        'debts',
        'installment_payments',
        'Installment Payments',
        'Pagos a plazos',
      ),
    ],
  },
  {
    key: 'categories.uncategorized',
    en: 'Uncategorized',
    es: 'Sin categoría',
    kind: expense,
    icon: 'other',
    children: [],
  },

  // Income
  {
    key: 'categories.income',
    en: 'Income',
    es: 'Ingresos',
    kind: CategoryKind.income,
    icon: 'income',
    children: [
      child('income', 'salary', 'Salary', 'Sueldo'),
      child('income', 'freelance', 'Freelance', 'Honorarios'),
      child('income', 'business', 'Business & Sales', 'Negocio y ventas'),
      child(
        'income',
        'investments',
        'Investments & Interest',
        'Inversiones e intereses',
      ),
      child('income', 'rental', 'Rental Income', 'Rentas cobradas'),
      child('income', 'refunds', 'Refunds', 'Reembolsos'),
      child('income', 'gifts_received', 'Gifts Received', 'Regalos recibidos'),
      child('income', 'other_income', 'Other Income', 'Otros ingresos'),
    ],
  },
];

/** Every catalog entry with its parent key, kind and order, parents first. */
export function catalogEntries(): Array<
  DefaultCategoryName & {
    parentKey: string | null;
    kind: CategoryKind;
    sortOrder: number;
  }
> {
  return DEFAULT_CATEGORIES.flatMap((parent, i) => [
    { ...parent, parentKey: null, sortOrder: i + 1 },
    ...parent.children.map((name, j) => ({
      ...name,
      parentKey: parent.key,
      kind: parent.kind,
      sortOrder: j + 1,
    })),
  ]);
}

/**
 * Creates or updates the global catalog (by key); never deletes. Idempotent,
 * so it runs on every start. Returns how many rows it created.
 */
export async function syncCategoryCatalog(
  prisma: PrismaClientLike,
): Promise<number> {
  const existing = await prisma.category.findMany({
    where: { userId: null, key: { not: null } },
    select: {
      id: true,
      key: true,
      name: true,
      parentId: true,
      kind: true,
      icon: true,
      sortOrder: true,
      isDefault: true,
      translations: { select: { locale: true, name: true } },
    },
  });
  const byKey = new Map(existing.map((row) => [row.key!, row]));
  let created = 0;

  for (const entry of catalogEntries()) {
    const parentId = entry.parentKey
      ? (byKey.get(entry.parentKey)?.id ?? null)
      : null;
    const data = {
      name: entry.en,
      parentId,
      kind: entry.kind,
      icon: entry.icon ?? null,
      sortOrder: entry.sortOrder,
      isDefault: true,
    };
    const row = byKey.get(entry.key);
    if (!row) {
      const createdRow = await prisma.category.create({
        data: {
          ...data,
          userId: null,
          key: entry.key,
          translations: {
            create: [
              { locale: 'en', name: entry.en, source: TranslationSource.seed },
              { locale: 'es', name: entry.es, source: TranslationSource.seed },
            ],
          },
        },
        select: { id: true },
      });
      byKey.set(entry.key, {
        ...data,
        id: createdRow.id,
        key: entry.key,
        translations: [
          { locale: 'en', name: entry.en },
          { locale: 'es', name: entry.es },
        ],
      });
      created += 1;
      continue;
    }

    const changed =
      row.name !== data.name ||
      row.parentId !== data.parentId ||
      row.kind !== data.kind ||
      row.icon !== data.icon ||
      row.sortOrder !== data.sortOrder ||
      !row.isDefault;
    if (changed) {
      await prisma.category.update({ where: { id: row.id }, data });
    }
    for (const [locale, name] of [
      ['en', entry.en],
      ['es', entry.es],
    ] as const) {
      if (row.translations.find((t) => t.locale === locale)?.name === name) {
        continue;
      }
      await prisma.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: row.id, locale } },
        create: {
          categoryId: row.id,
          locale,
          name,
          source: TranslationSource.seed,
        },
        update: { name, source: TranslationSource.seed },
      });
    }
  }
  return created;
}

export const LOAN_PAYMENTS_CATEGORY_KEY = 'categories.debts.loan_payments';
export const INSTALLMENT_PAYMENTS_CATEGORY_KEY =
  'categories.debts.installment_payments';

/**
 * Default category of a debt's payments: purchase financing and MSI are
 * installment payments, any other loan a loan payment.
 */
export function debtPaymentCategoryKey(kind: 'loan' | 'installment'): string {
  return kind === 'installment'
    ? INSTALLMENT_PAYMENTS_CATEGORY_KEY
    : LOAN_PAYMENTS_CATEGORY_KEY;
}

/** The global catalog category with that key. */
export async function defaultCategoryId(
  prisma: PrismaClientLike,
  key: string,
): Promise<string | undefined> {
  const row = await prisma.category.findFirst({
    where: { userId: null, key },
    select: { id: true },
  });
  return row?.id;
}
