import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../../services/prisma.service';
import { CategoryI18nLoader } from './category-names';

describe('CategoryI18nLoader', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let loader: CategoryI18nLoader;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    prisma.category.findMany.mockResolvedValue([
      {
        id: 'a',
        key: 'categories.food',
        name: 'Food & Dining',
        translations: [{ name: 'Comida y restaurantes' }],
      },
      { id: 'b', key: null, name: 'Pets', translations: [] },
    ] as never);
    loader = new CategoryI18nLoader(prisma);
  });

  it('batches the categories of one tick into one query and caches them', async () => {
    const req = {};
    const [a, b, again] = await Promise.all([
      loader.load(req, 'a', 'es'),
      loader.load(req, 'b', 'es'),
      loader.load(req, 'a', 'es'),
    ]);

    expect(prisma.category.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['a', 'b'] } },
        select: expect.objectContaining({
          translations: { where: { locale: 'es' }, select: { name: true } },
        }),
      }),
    );
    expect(a).toEqual({
      key: 'categories.food',
      name: 'Comida y restaurantes',
      originalName: 'Food & Dining',
    });
    // Without a translation, the English original.
    expect(b?.name).toBe('Pets');
    expect(again).toBe(a);

    await loader.load(req, 'a', 'es');
    expect(prisma.category.findMany).toHaveBeenCalledTimes(1);
  });

  it('keeps requests apart', async () => {
    await loader.load({}, 'a', 'es');
    await loader.load({}, 'a', 'es');
    expect(prisma.category.findMany).toHaveBeenCalledTimes(2);
  });
});
