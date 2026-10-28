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
  sortOrder: null,
  createdAt: new Date('2026-10-13'),
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
    service = new CategoriesService(prisma, translation);
  });

  describe('create', () => {
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
        sortOrder: 2,
      });
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
