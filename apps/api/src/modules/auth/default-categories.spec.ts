import { mockDeep } from 'jest-mock-extended';
import type { PrismaClient } from '@finnit/database';
import {
  DEFAULT_CATEGORIES,
  createDefaultCategories,
} from './default-categories';

describe('default categories', () => {
  const all = DEFAULT_CATEGORIES.flatMap((p) => [p, ...p.children]);

  it('has unique keys and English names (category_user_name_unique)', () => {
    expect(new Set(all.map((c) => c.key)).size).toBe(all.length);
    expect(new Set(all.map((c) => c.en)).size).toBe(all.length);
    for (const parent of DEFAULT_CATEGORIES) {
      for (const child of parent.children) {
        expect(child.key.startsWith(`${parent.key}.`)).toBe(true);
      }
    }
    for (const c of all) expect(c.key).toMatch(/^categories(\.[a-z_]+)+$/);
  });

  it('creates every category with its key and es/en seed names', async () => {
    const prisma = mockDeep<PrismaClient>();
    prisma.category.create.mockResolvedValue({ id: 'parent' } as never);

    await createDefaultCategories(prisma, 'user-1');

    expect(prisma.category.findMany).not.toHaveBeenCalled();
    expect(prisma.category.create).toHaveBeenCalledTimes(all.length);
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        parentId: 'parent',
        key: 'categories.food.groceries',
        name: 'Groceries',
        translations: {
          create: [
            { locale: 'en', name: 'Groceries', source: 'seed' },
            { locale: 'es', name: 'Supermercado', source: 'seed' },
          ],
        },
      }),
    });
  });

  it('skips the categories the user already has', async () => {
    const prisma = mockDeep<PrismaClient>();
    prisma.category.findMany.mockResolvedValue(
      all.map((c, i) => ({ id: `c${i}`, key: c.key, name: c.en })) as never,
    );

    await createDefaultCategories(prisma, 'user-1', { skipExisting: true });

    expect(prisma.category.create).not.toHaveBeenCalled();
  });
});
