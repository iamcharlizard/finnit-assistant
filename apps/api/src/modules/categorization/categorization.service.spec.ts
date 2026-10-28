import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import {
  AiFeatureKey,
  CategorySource,
  Prisma,
  TransactionSource,
  TransactionType,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import {
  AiFeatureDisabledError,
  AiModelsService,
} from '../ai/ai-models.service';
import { CategorizationService } from './categorization.service';
import { MerchantRulesService } from './merchant-rules.service';

const userId = 'user-1';

const row = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  userId,
  accountId: 'acc-1',
  categoryId: null,
  type: TransactionType.expense,
  amount: new Prisma.Decimal(100),
  currency: 'MXN',
  txnDate: new Date('2026-10-01'),
  description: null,
  merchantName: `MERCHANT ${id}`,
  isPending: false,
  isRecurringInstance: false,
  source: TransactionSource.imported,
  externalId: null,
  aliasId: null,
  aliasName: null,
  isPrivate: false,
  categorySource: null,
  suggestedCategoryId: null,
  suggestedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  account: { id: 'acc-1', name: 'Card 1234', balanceCurrent: 5000 },
  category: null,
  attachments: [],
  alias: null,
  suggestedCategory: null,
  ...overrides,
});

const categories = [
  {
    id: 'food',
    parentId: null,
    name: 'Food',
    translations: [{ locale: 'es', name: 'Comida' }],
  },
  {
    id: 'coffee',
    parentId: 'food',
    name: 'Coffee',
    translations: [{ locale: 'es', name: 'Café' }],
  },
  { id: 'gifts', parentId: null, name: 'Gifts', translations: [] },
];

describe('CategorizationService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let tx: DeepMockProxy<Prisma.TransactionClient>;
  let rules: DeepMockProxy<MerchantRulesService>;
  let ai: DeepMockProxy<AiModelsService>;
  let service: CategorizationService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    tx = mockDeep<Prisma.TransactionClient>();
    rules = mockDeep<MerchantRulesService>();
    ai = mockDeep<AiModelsService>();
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? Promise.resolve((arg as (c: unknown) => unknown)(tx))
        : Promise.all(arg as Promise<unknown>[]),
    );
    rules.match.mockResolvedValue(new Map());
    prisma.category.findMany.mockResolvedValue(categories as never);
    service = new CategorizationService(prisma, rules, ai);
  });

  describe('categorizeTransactions', () => {
    beforeEach(() => {
      prisma.category.findFirst.mockResolvedValue({ id: 'coffee' } as never);
      tx.transaction.findMany.mockResolvedValue([
        { id: 't1', merchantName: 'STARBUCKS 123', description: null },
        { id: 't2', merchantName: null, description: 'Starbucks Reforma' },
      ] as never);
      tx.transaction.updateMany.mockResolvedValue({ count: 2 });
    });

    it("updates only the user's movements, as manual, and clears suggestions", async () => {
      const count = await service.categorize(
        userId,
        ['t1', 't2', 't1', 'someone-elses'],
        'coffee',
      );

      expect(count).toBe(2);
      expect(tx.transaction.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['t1', 't2', 'someone-elses'] }, userId },
        select: { id: true, merchantName: true, description: true },
      });
      expect(tx.transaction.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['t1', 't2'] }, userId },
        data: {
          categoryId: 'coffee',
          categorySource: CategorySource.manual,
          suggestedCategoryId: null,
          suggestedBy: null,
        },
      });
    });

    it('learns a merchant rule per merchant by default', async () => {
      await service.categorize(userId, ['t1', 't2'], 'coffee');
      expect(rules.learn).toHaveBeenCalledWith(tx, userId, [
        { text: 'STARBUCKS 123', categoryId: 'coffee' },
        { text: 'Starbucks Reforma', categoryId: 'coffee' },
      ]);
    });

    it('does not learn when createRule is false', async () => {
      await service.categorize(userId, ['t1'], 'coffee', false);
      expect(rules.learn).not.toHaveBeenCalled();
    });

    it("rejects a category the user can't use", async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      await expect(service.categorize(userId, ['t1'], 'x')).rejects.toThrow(
        NotFoundError,
      );
      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: { id: 'x', OR: [{ userId }, { userId: null, isDefault: true }] },
        select: { id: true },
      });
    });

    it('accepts at most 500 movements', async () => {
      const ids = Array.from({ length: 501 }, (_, i) => `t${i}`);
      await expect(service.categorize(userId, ids, 'coffee')).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe('suggestTransactionCategories', () => {
    const t1 = row('t1', { merchantName: 'STARBUCKS 123' });
    const t2 = row('t2', { merchantName: 'CAFE PUNTA DEL CIELO' });
    const t3 = row('t3', {
      merchantName: 'LIVERPOOL SECRETO',
      isPrivate: true,
      aliasName: 'Regalo',
    });
    const done = row('t4', { categoryId: 'food' });
    const transfer = row('t5', { type: TransactionType.transfer });

    beforeEach(() => {
      prisma.transaction.findMany.mockResolvedValue([
        t1,
        t2,
        t3,
        done,
        transfer,
      ] as never);
      prisma.transaction.updateMany.mockResolvedValue({ count: 1 });
      rules.match.mockResolvedValue(
        new Map([['STARBUCKS 123', { ruleId: 'r1', categoryId: 'coffee' }]]),
      );
    });

    it('uses rules first and sends the rest to the AI in one call', async () => {
      ai.extractFromText.mockResolvedValue({
        model: {} as never,
        data: {
          items: [
            { ref: 't1', categoryRef: 'c2' },
            { ref: 't2', categoryRef: 'c3' },
          ],
        },
      });

      const result = await service.suggest(userId, [
        't1',
        't2',
        't3',
        't4',
        't5',
      ]);

      expect(ai.extractFromText).toHaveBeenCalledTimes(1);
      const [request, options] = ai.extractFromText.mock.calls[0];
      expect(options).toEqual({
        feature: AiFeatureKey.transaction_categorization,
      });
      const sent = JSON.parse(request.text) as {
        movements: unknown[];
        categories: unknown[];
      };
      // Only movements without a rule, already categorized or transfers skipped;
      // the private one goes with its display name, never the original.
      expect(sent.movements).toEqual([
        {
          ref: 't1',
          text: 'CAFE PUNTA DEL CIELO',
          amount: 100,
          type: 'expense',
        },
        { ref: 't2', text: 'Regalo', amount: 100, type: 'expense' },
      ]);
      expect(request.text).not.toContain('LIVERPOOL');
      expect(request.text).not.toContain('Card 1234');
      expect(request.text).not.toContain('5000');
      expect(sent.categories).toEqual([
        { ref: 'c1', name: 'Comida' },
        { ref: 'c2', name: 'Comida > Café' },
        { ref: 'c3', name: 'Gifts' },
      ]);

      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: { id: 't1', userId, categoryId: null },
        data: {
          suggestedCategoryId: 'coffee',
          suggestedBy: CategorySource.rule,
        },
      });
      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: { id: 't2', userId, categoryId: null },
        data: { suggestedCategoryId: 'coffee', suggestedBy: CategorySource.ai },
      });
      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: { id: 't3', userId, categoryId: null },
        data: { suggestedCategoryId: 'gifts', suggestedBy: CategorySource.ai },
      });
      expect(prisma.transaction.updateMany).toHaveBeenCalledTimes(3);
      expect(result.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4', 't5']);
    });

    it('ignores AI answers with unknown refs or categories', async () => {
      ai.extractFromText.mockResolvedValue({
        model: {} as never,
        data: {
          items: [
            { ref: 't1', categoryRef: 'not-a-category' },
            { ref: 't9', categoryRef: 'c1' },
            { ref: 't2', categoryRef: 'other-users-category-id' },
            'garbage',
          ],
        },
      });

      await service.suggest(userId, ['t1', 't2', 't3']);

      // Only the rule suggestion is stored.
      expect(prisma.transaction.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.transaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't1', userId, categoryId: null },
        }),
      );
    });

    it('without AI it still returns the rule suggestions', async () => {
      ai.extractFromText.mockRejectedValue(
        new AiFeatureDisabledError(AiFeatureKey.transaction_categorization),
      );

      const result = await service.suggest(userId, ['t1', 't2']);

      expect(result).toHaveLength(5);
      expect(prisma.transaction.updateMany).toHaveBeenCalledTimes(1);
    });

    it('does not call the AI when every movement has a rule', async () => {
      prisma.transaction.findMany.mockResolvedValue([t1] as never);
      await service.suggest(userId, ['t1']);
      expect(ai.extractFromText).not.toHaveBeenCalled();
    });

    it("only loads the user's movements", async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      await expect(service.suggest(userId, ['x'])).resolves.toEqual([]);
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['x'] }, userId } }),
      );
    });

    it('accepts at most 100 movements', async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `t${i}`);
      await expect(service.suggest(userId, ids)).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe('accept / reject', () => {
    it('applies the suggestion with its source and learns the rule', async () => {
      tx.transaction.findMany.mockResolvedValue([
        {
          id: 't1',
          merchantName: 'STARBUCKS',
          description: null,
          suggestedCategoryId: 'coffee',
        },
      ] as never);
      tx.$executeRaw.mockResolvedValue(1);

      await expect(service.accept(userId, ['t1', 't2'])).resolves.toBe(1);

      expect(tx.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: ['t1', 't2'] },
            userId,
            suggestedCategoryId: { not: null },
          },
        }),
      );
      const sql = tx.$executeRaw.mock.calls[0] as unknown as [
        TemplateStringsArray,
        ...unknown[],
      ];
      expect(sql[0].join('?')).toContain(
        '"categorySource" = COALESCE("suggestedBy"',
      );
      expect(sql.slice(1)).toEqual([userId, ['t1']]);
      expect(rules.learn).toHaveBeenCalledWith(tx, userId, [
        { text: 'STARBUCKS', categoryId: 'coffee' },
      ]);
    });

    it('accepting nothing pending changes nothing', async () => {
      tx.transaction.findMany.mockResolvedValue([]);
      await expect(service.accept(userId, ['t1'])).resolves.toBe(0);
      expect(tx.$executeRaw).not.toHaveBeenCalled();
      expect(rules.learn).not.toHaveBeenCalled();
    });

    it("rejecting clears only the user's pending suggestions", async () => {
      prisma.transaction.updateMany.mockResolvedValue({ count: 2 });
      await expect(service.reject(userId, ['t1', 't2'])).resolves.toBe(2);
      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['t1', 't2'] },
          userId,
          suggestedCategoryId: { not: null },
        },
        data: { suggestedCategoryId: null, suggestedBy: null },
      });
    });
  });
});
