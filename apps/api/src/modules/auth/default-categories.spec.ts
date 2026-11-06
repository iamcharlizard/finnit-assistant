import { mockDeep } from 'jest-mock-extended';
import type { PrismaClient } from '@finnit/database';
import {
  DEFAULT_CATEGORIES,
  INSTALLMENT_PAYMENTS_CATEGORY_KEY,
  LOAN_PAYMENTS_CATEGORY_KEY,
  catalogEntries,
  debtPaymentCategoryKey,
  syncCategoryCatalog,
} from './default-categories';

/** Keys shipped before the global catalog: they must never go away. */
const SHIPPED_KEYS = [
  'categories.food',
  'categories.food.groceries',
  'categories.food.restaurants',
  'categories.food.coffee_snacks',
  'categories.transportation',
  'categories.transportation.gas',
  'categories.transportation.public_transit',
  'categories.transportation.parking',
  'categories.transportation.car_maintenance',
  'categories.shopping',
  'categories.shopping.clothing',
  'categories.shopping.electronics',
  'categories.shopping.books',
  'categories.shopping.general',
  'categories.bills',
  'categories.bills.electricity',
  'categories.bills.water',
  'categories.bills.internet',
  'categories.bills.phone',
  'categories.bills.home_insurance',
  'categories.entertainment',
  'categories.entertainment.movies',
  'categories.entertainment.sports',
  'categories.entertainment.hobbies',
  'categories.entertainment.subscriptions',
  'categories.health',
  'categories.health.doctor',
  'categories.health.pharmacy',
  'categories.health.fitness',
  'categories.health.health_insurance',
  'categories.education',
  'categories.education.tuition',
  'categories.education.textbooks',
  'categories.education.supplies',
  'categories.personal_care',
  'categories.personal_care.hair',
  'categories.personal_care.beauty',
  'categories.personal_care.grooming',
  'categories.debts',
  'categories.debts.loan_payments',
  'categories.debts.installment_payments',
  'categories.income',
  'categories.income.salary',
  'categories.income.freelance',
  'categories.income.investments',
  'categories.income.other_income',
  'categories.uncategorized',
];

describe('category catalog', () => {
  const all = catalogEntries();

  it('has unique keys and English names', () => {
    expect(new Set(all.map((c) => c.key)).size).toBe(all.length);
    expect(new Set(all.map((c) => c.en)).size).toBe(all.length);
    expect(new Set(all.map((c) => c.es)).size).toBe(all.length);
    for (const c of all) expect(c.key).toMatch(/^categories(\.[a-z_]+)+$/);
  });

  it('keeps every key shipped before', () => {
    const keys = new Set(all.map((c) => c.key));
    for (const key of SHIPPED_KEYS) expect(keys).toContain(key);
  });

  it('gives every main category an icon and children their kind', () => {
    for (const parent of DEFAULT_CATEGORIES) expect(parent.icon).toBeTruthy();
    const income = all.filter((c) => c.kind === 'income');
    expect(income.every((c) => c.key.startsWith('categories.income'))).toBe(
      true,
    );
  });

  it('creates the missing entries, parents first, with es/en seed names', async () => {
    const prisma = mockDeep<PrismaClient>();
    prisma.category.findMany.mockResolvedValue([]);
    let n = 0;
    prisma.category.create.mockImplementation(
      () => Promise.resolve({ id: `id-${n++}` }) as never,
    );

    await expect(syncCategoryCatalog(prisma)).resolves.toBe(all.length);

    const calls = prisma.category.create.mock.calls.map((c) => c[0].data);
    expect(calls[0]).toMatchObject({
      key: 'categories.housing',
      parentId: null,
      userId: null,
      isDefault: true,
      kind: 'expense',
      icon: 'housing',
    });
    expect(calls[1]).toMatchObject({
      key: 'categories.housing.rent',
      parentId: 'id-0',
    });
    expect(
      calls.find((d) => d.key === 'categories.food.groceries'),
    ).toMatchObject({
      name: 'Groceries',
      translations: {
        create: [
          { locale: 'en', name: 'Groceries', source: 'seed' },
          { locale: 'es', name: 'Supermercado', source: 'seed' },
        ],
      },
    });
  });

  it('changes nothing when the catalog is already in place', async () => {
    const prisma = mockDeep<PrismaClient>();
    const ids = new Map(all.map((c, i) => [c.key, `id-${i}`]));
    prisma.category.findMany.mockResolvedValue(
      all.map((c) => ({
        id: ids.get(c.key)!,
        key: c.key,
        name: c.en,
        parentId: c.parentKey ? ids.get(c.parentKey)! : null,
        kind: c.kind,
        icon: c.icon ?? null,
        sortOrder: c.sortOrder,
        isDefault: true,
        translations: [
          { locale: 'en', name: c.en },
          { locale: 'es', name: c.es },
        ],
      })) as never,
    );

    await expect(syncCategoryCatalog(prisma)).resolves.toBe(0);
    expect(prisma.category.create).not.toHaveBeenCalled();
    expect(prisma.category.update).not.toHaveBeenCalled();
    expect(prisma.categoryTranslation.upsert).not.toHaveBeenCalled();
  });

  it('files loan and installment payments under Loans & Debts', () => {
    const keys = all.map((c) => c.key);
    expect(keys).toContain(LOAN_PAYMENTS_CATEGORY_KEY);
    expect(keys).toContain(INSTALLMENT_PAYMENTS_CATEGORY_KEY);
    expect(debtPaymentCategoryKey('loan')).toBe(LOAN_PAYMENTS_CATEGORY_KEY);
    expect(debtPaymentCategoryKey('installment')).toBe(
      INSTALLMENT_PAYMENTS_CATEGORY_KEY,
    );
  });
});
