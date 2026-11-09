import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Prisma } from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import { ValidationError } from '../../common/exceptions/graphql-error.exception';
import { TranslationService } from '../translation/translation.service';
import { CategoriesService } from './categories.service';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'cat-1',
  userId: 'user-1',
  parentId: null,
  name: 'Pets',
  key: null,
  isDefault: false,
  kind: 'expense' as const,
  icon: null,
  color: null,
  sortOrder: null,
  excludeFromTotals: false,
  createdAt: new Date('2026-10-13'),
  children: [],
  translations: [
    { locale: 'en', name: 'Pets' },
    { locale: 'es', name: 'Mascotas' },
  ],
  ...overrides,
});

describe('CategoriesService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let translation: DeepMockProxy<TranslationService>;
  let service: CategoriesService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    translation = mockDeep<TranslationService>();
    translation.translateName.mockResolvedValue({
      en: { name: 'Pets', source: 'google' },
      es: { name: 'Mascotas', source: 'user' },
    });
    prisma.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) =>
      fn(prisma)) as never);
    prisma.categoryHidden.findMany.mockResolvedValue([]);
    service = new CategoriesService(prisma, translation);
  });

  describe('create', () => {
    it('leaves a subcategory of an excluded category out too', async () => {
      prisma.category.findFirst
        .mockResolvedValueOnce(
          row({ id: 'parent', excludeFromTotals: true }) as never,
        )
        .mockResolvedValueOnce(null);
      prisma.category.create.mockResolvedValue(row());

      await service.create('user-1', { name: 'Mascotas', parentId: 'parent' });

      expect(prisma.category.create.mock.calls[0][0].data).toMatchObject({
        parentId: 'parent',
        excludeFromTotals: true,
      });
    });

    it('stores the English name and both translations', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue(row());

      const category = await service.create('user-1', { name: ' Mascotas ' });

      expect(translation.translateName).toHaveBeenCalledWith('Mascotas');
      expect(prisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            name: 'Pets',
            translations: {
              create: [
                { locale: 'es', name: 'Mascotas', source: 'user' },
                { locale: 'en', name: 'Pets', source: 'google' },
              ],
            },
          }),
        }),
      );
      expect(category).toEqual(
        expect.objectContaining({
          name: 'Pets',
          key: null,
          translations: { en: 'Pets', es: 'Mascotas' },
        }),
      );
    });

    it('rejects a name the user already has (in English)', async () => {
      prisma.category.findFirst.mockResolvedValue(row());

      await expect(
        service.create('user-1', { name: 'Mascotas' }),
      ).rejects.toThrow(ValidationError);
      expect(prisma.category.create).not.toHaveBeenCalled();
    });

    it('maps a unique violation to a ValidationError', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.category.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x',
        }),
      );

      await expect(
        service.create('user-1', { name: 'Mascotas' }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('update', () => {
    it('leaves a category and its subcategories out of the totals', async () => {
      prisma.category.findFirst.mockResolvedValueOnce(row());
      prisma.category.update.mockResolvedValue(
        row({ excludeFromTotals: true }),
      );

      const result = await service.update('cat-1', 'user-1', {
        excludeFromTotals: true,
      });

      expect(prisma.category.update.mock.calls[0][0].data).toMatchObject({
        excludeFromTotals: true,
      });
      expect(prisma.category.updateMany).toHaveBeenCalledWith({
        where: { parentId: 'cat-1', userId: 'user-1' },
        data: { excludeFromTotals: true },
      });
      expect(result.excludeFromTotals).toBe(true);
    });

    it('does not touch the subcategories when the flag stays', async () => {
      prisma.category.findFirst.mockResolvedValueOnce(row());
      prisma.category.update.mockResolvedValue(row());

      await service.update('cat-1', 'user-1', { icon: 'pets' });

      expect(prisma.category.updateMany).not.toHaveBeenCalled();
    });

    it('re-translates on rename and upserts both locales', async () => {
      prisma.category.findFirst
        .mockResolvedValueOnce(
          row({
            name: 'Dogs',
            translations: [
              { locale: 'en', name: 'Dogs' },
              { locale: 'es', name: 'Perros' },
            ],
          }),
        )
        .mockResolvedValueOnce(null);
      prisma.category.update.mockResolvedValue(row());

      await service.update('cat-1', 'user-1', { name: 'Mascotas' });

      const data = prisma.category.update.mock.calls[0][0].data as {
        name: string;
        translations: { upsert: unknown[] };
      };
      expect(data.name).toBe('Pets');
      expect(data.translations.upsert).toEqual([
        {
          where: { categoryId_locale: { categoryId: 'cat-1', locale: 'es' } },
          create: { locale: 'es', name: 'Mascotas', source: 'user' },
          update: { name: 'Mascotas', source: 'user' },
        },
        {
          where: { categoryId_locale: { categoryId: 'cat-1', locale: 'en' } },
          create: { locale: 'en', name: 'Pets', source: 'google' },
          update: { name: 'Pets', source: 'google' },
        },
      ]);
    });

    it('does not translate when the name sent is a current name', async () => {
      prisma.category.findFirst.mockResolvedValueOnce(row());
      prisma.category.update.mockResolvedValue(row());

      await service.update('cat-1', 'user-1', {
        name: 'Mascotas',
        sortOrder: 2,
      });

      expect(translation.translateName).not.toHaveBeenCalled();
      expect(prisma.category.update.mock.calls[0][0].data).toEqual({
        parentId: null,
        kind: 'expense',
        excludeFromTotals: false,
        sortOrder: 2,
      });
    });

    it('refuses to change a catalog category', async () => {
      prisma.category.findFirst.mockResolvedValueOnce(
        row({ userId: null, isDefault: true }),
      );

      await expect(
        service.update('cat-1', 'user-1', { name: 'Otra' }),
      ).rejects.toThrow(ValidationError);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it("gives the subcategories a main category's new kind", async () => {
      prisma.category.findFirst.mockResolvedValueOnce(row());
      prisma.category.update.mockResolvedValue(row({ kind: 'income' }));

      await service.update('cat-1', 'user-1', { kind: 'income' });

      expect(prisma.category.updateMany).toHaveBeenCalledWith({
        where: { parentId: 'cat-1', userId: 'user-1' },
        data: { kind: 'income' },
      });
    });
  });

  describe('subcategories', () => {
    it('hang from a catalog category and take its kind', async () => {
      prisma.category.findFirst
        .mockResolvedValueOnce({
          id: 'income',
          kind: 'income',
          parentId: null,
        } as never)
        .mockResolvedValueOnce(null);
      prisma.category.create.mockResolvedValue(row());

      await service.create('user-1', {
        name: 'Mascotas',
        parentId: 'income',
        kind: 'expense',
      });

      expect(prisma.category.create.mock.calls[0][0].data).toMatchObject({
        userId: 'user-1',
        parentId: 'income',
        kind: 'income',
      });
    });

    it('go two levels deep at most', async () => {
      prisma.category.findFirst.mockResolvedValueOnce({
        id: 'groceries',
        kind: 'expense',
        parentId: 'food',
      } as never);

      await expect(
        service.create('user-1', { name: 'Frutas', parentId: 'groceries' }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('delete', () => {
    const inUse = () => {
      prisma.transaction.count.mockResolvedValue(3);
      prisma.category.count.mockResolvedValue(0);
      prisma.bUDGET_CATEGORY.count.mockResolvedValue(0);
      prisma.merchantRule.count.mockResolvedValue(1);
      prisma.merchantAlias.count.mockResolvedValue(0);
      prisma.recurringExpense.count.mockResolvedValue(0);
    };

    it('asks where to move what a category in use has', async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: 'cat-1',
        userId: 'user-1',
        isDefault: false,
        kind: 'expense',
      } as never);
      inUse();

      await expect(service.delete('cat-1', 'user-1')).rejects.toThrow(
        ValidationError,
      );
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it('moves movements and rules to the target, then deletes', async () => {
      prisma.category.findFirst
        .mockResolvedValueOnce({
          id: 'cat-1',
          userId: 'user-1',
          isDefault: false,
          kind: 'expense',
        } as never)
        .mockResolvedValueOnce({
          id: 'cat-1',
          userId: 'user-1',
          isDefault: false,
          kind: 'expense',
        } as never)
        .mockResolvedValueOnce({
          id: 'food',
          parentId: null,
          kind: 'expense',
        } as never);
      inUse();
      prisma.bUDGET_CATEGORY.findMany.mockResolvedValue([]);

      await service.delete('cat-1', 'user-1', 'food');

      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', categoryId: 'cat-1' },
        data: { categoryId: 'food' },
      });
      expect(prisma.merchantRule.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', categoryId: 'cat-1' },
        data: { categoryId: 'food' },
      });
      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
      });
    });

    it('refuses a target of the other kind', async () => {
      prisma.category.findFirst
        .mockResolvedValueOnce({
          id: 'cat-1',
          userId: 'user-1',
          isDefault: false,
          kind: 'expense',
        } as never)
        .mockResolvedValueOnce({
          id: 'cat-1',
          userId: 'user-1',
          isDefault: false,
          kind: 'expense',
        } as never)
        .mockResolvedValueOnce({
          id: 'salary',
          parentId: 'income',
          kind: 'income',
        } as never);
      inUse();

      await expect(service.delete('cat-1', 'user-1', 'salary')).rejects.toThrow(
        ValidationError,
      );
    });

    it('never deletes a catalog category', async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: 'food',
        userId: null,
        isDefault: true,
        kind: 'expense',
      } as never);

      await expect(service.delete('food', 'user-1')).rejects.toThrow(
        ValidationError,
      );
    });
  });

  it('hides a category with its subcategories', async () => {
    prisma.category.findFirst.mockResolvedValue({
      id: 'food',
      children: [{ id: 'groceries' }, { id: 'coffee' }],
    } as never);

    await service.hide('user-1', 'food');

    expect(prisma.categoryHidden.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'user-1', categoryId: 'food' },
        { userId: 'user-1', categoryId: 'groceries' },
        { userId: 'user-1', categoryId: 'coffee' },
      ],
      skipDuplicates: true,
    });
  });

  it('getCategoryUsage reports the name in the requested locale', async () => {
    prisma.category.findMany.mockResolvedValue([
      {
        ...row(),
        translations: [{ name: 'Mascotas' }],
        transactions: [{ amount: new Prisma.Decimal(100), type: 'expense' }],
      },
    ] as never);

    const [usage] = await service.getCategoryUsage(
      'user-1',
      undefined,
      undefined,
      'es',
    );

    expect(usage.categoryName).toBe('Mascotas');
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          translations: { where: { locale: 'es' }, select: { name: true } },
        }),
      }),
    );
  });

  describe('getCategoryUsage filters', () => {
    const transactionsWhere = () =>
      (
        prisma.category.findMany.mock.calls[0][0] as {
          include: { transactions: { where: Record<string, unknown> } };
        }
      ).include.transactions.where;

    beforeEach(() => {
      prisma.category.findMany.mockResolvedValue([] as never);
    });

    it('applies both ends of the date range', async () => {
      const dateFrom = new Date('2026-10-01T00:00:00Z');
      const dateTo = new Date('2026-10-31T00:00:00Z');

      await service.getCategoryUsage('user-1', dateFrom, dateTo);

      expect(transactionsWhere()).toEqual({
        userId: 'user-1',
        txnDate: { gte: dateFrom, lte: dateTo },
        type: { in: ['income', 'expense'] },
      });
    });

    it('applies a single end of the range', async () => {
      const dateTo = new Date('2026-10-31T00:00:00Z');

      await service.getCategoryUsage('user-1', undefined, dateTo);

      expect(transactionsWhere().txnDate).toEqual({ lte: dateTo });
    });

    it('has no date filter without a range, and leaves out transfers and adjustments', async () => {
      await service.getCategoryUsage('user-1');

      expect(transactionsWhere()).toEqual({
        userId: 'user-1',
        type: { in: ['income', 'expense'] },
      });
    });
  });
});
