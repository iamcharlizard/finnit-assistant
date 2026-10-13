import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AliasMatchType, Prisma } from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import {
  MAX_ALIASES_PER_USER,
  MerchantAliasesService,
} from './merchant-aliases.service';
import { MerchantAliasInput } from './dto/merchant-alias.dto';

const userId = 'user-1';

const aliasRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'alias-1',
  userId,
  matchType: AliasMatchType.contains,
  pattern: 'farmacia',
  displayName: 'Farmacia',
  categoryId: null,
  category: null,
  isPrivate: false,
  priority: 0,
  active: true,
  createdAt: new Date('2026-10-01'),
  updatedAt: new Date('2026-10-01'),
  _count: { transactions: 3 },
  ...overrides,
});

const input = (overrides: Partial<MerchantAliasInput> = {}) => ({
  matchType: AliasMatchType.contains,
  pattern: '  farmacia ',
  displayName: ' Farmacia ',
  ...overrides,
});

/** The SQL text of every raw statement run on the mock. */
const rawTexts = (fn: jest.Mock) =>
  fn.mock.calls.map((call: unknown[]) =>
    typeof call[0] === 'string' ? call[0] : (call[0] as Prisma.Sql).text,
  );

describe('MerchantAliasesService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let tx: DeepMockProxy<Prisma.TransactionClient>;
  let service: MerchantAliasesService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    tx = mockDeep<Prisma.TransactionClient>();
    prisma.$transaction.mockImplementation((fn: (client: unknown) => unknown) =>
      Promise.resolve(fn(tx)),
    );
    tx.merchantAlias.create.mockResolvedValue(aliasRow());
    prisma.merchantAlias.findFirst.mockResolvedValue(aliasRow());
    prisma.merchantAlias.count.mockResolvedValue(0);
    service = new MerchantAliasesService(prisma);
  });

  describe('validation', () => {
    it('trims the pattern and the name and applies defaults', async () => {
      await expect(service.validate(userId, input())).resolves.toEqual({
        matchType: AliasMatchType.contains,
        pattern: 'farmacia',
        displayName: 'Farmacia',
        categoryId: null,
        isPrivate: false,
        priority: 0,
        active: true,
      });
    });

    it.each([
      ['an empty pattern', { pattern: '   ' }],
      ['a pattern over 200 characters', { pattern: 'x'.repeat(201) }],
      ['an empty display name', { displayName: ' ' }],
      ['a display name over 80 characters', { displayName: 'x'.repeat(81) }],
      ['an unknown match type', { matchType: 'glob' as AliasMatchType }],
    ])('rejects %s', async (_, overrides) => {
      await expect(service.validate(userId, input(overrides))).rejects.toThrow(
        ValidationError,
      );
    });

    it("rejects a category that is not the user's or a default", async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      await expect(
        service.validate(userId, input({ categoryId: 'other-users' })),
      ).rejects.toThrow(NotFoundError);
      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'other-users',
          OR: [{ userId }, { userId: null, isDefault: true }],
        },
        select: { id: true },
      });
    });

    it('compiles a regex in Postgres and rejects an invalid one', async () => {
      prisma.$queryRaw.mockRejectedValue(
        new Error(
          'Raw query failed. Code: `2201B`. Message: `invalid regular expression: parentheses () not balanced`',
        ),
      );
      await expect(
        service.validate(
          userId,
          input({ matchType: AliasMatchType.regex, pattern: '(uber' }),
        ),
      ).rejects.toThrow(new ValidationError('Invalid regular expression'));
      const sql = prisma.$queryRaw.mock.calls[0][0] as unknown as Prisma.Sql;
      expect(sql.text).toContain('~*');
      expect(sql.values).toEqual(['(uber']);
    });

    it('accepts a valid regex', async () => {
      prisma.$queryRaw.mockResolvedValue([{ ok: false }]);
      await expect(
        service.validate(
          userId,
          input({ matchType: AliasMatchType.regex, pattern: '^uber\\s*eats' }),
        ),
      ).resolves.toMatchObject({ pattern: '^uber\\s*eats' });
    });

    it('does not compile plain patterns as regex', async () => {
      await service.validate(userId, input({ pattern: '(50%' }));
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('the preview accepts an empty name (the user is still typing)', async () => {
      await expect(
        service.validate(userId, input({ displayName: '' }), { preview: true }),
      ).resolves.toMatchObject({ displayName: '' });
    });
  });

  describe('create', () => {
    it('saves the alias and recomputes the user aliases with a time cap, in one transaction', async () => {
      const alias = await service.create(userId, input({ isPrivate: true }));

      expect(tx.merchantAlias.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          pattern: 'farmacia',
          isPrivate: true,
        }),
      });
      expect(rawTexts(tx.$executeRawUnsafe)).toEqual([
        "SET LOCAL statement_timeout = '5s'",
      ]);
      const recompute = tx.$executeRaw.mock
        .calls[0][0] as unknown as Prisma.Sql;
      expect(recompute.text).toContain('UPDATE "Transaction"');
      expect(recompute.values).toEqual([userId]);
      expect(alias).toMatchObject({ id: 'alias-1', matchCount: 3 });
    });

    it(`allows at most ${MAX_ALIASES_PER_USER} aliases`, async () => {
      prisma.merchantAlias.count.mockResolvedValue(MAX_ALIASES_PER_USER);
      await expect(service.create(userId, input())).rejects.toThrow(
        ValidationError,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('reports a pattern that hits the statement timeout', async () => {
      tx.$executeRaw.mockRejectedValue(
        Object.assign(
          new Error('canceling statement due to statement timeout'),
          {
            code: 'P2010',
            meta: { code: '57014' },
          },
        ),
      );
      await expect(service.create(userId, input())).rejects.toThrow(
        new ValidationError(
          'The pattern takes too long to evaluate; simplify it',
        ),
      );
    });
  });

  describe('update and delete', () => {
    it("never touches another user's alias", async () => {
      prisma.merchantAlias.findFirst.mockResolvedValue(null);
      await expect(service.update(userId, 'alias-9', input())).rejects.toThrow(
        NotFoundError,
      );
      await expect(service.delete(userId, 'alias-9')).rejects.toThrow(
        NotFoundError,
      );
      expect(prisma.merchantAlias.findFirst).toHaveBeenCalledWith({
        where: { id: 'alias-9', userId },
        select: { id: true },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('deleting recomputes, so a lower-priority alias can take over', async () => {
      await service.delete(userId, 'alias-1');
      expect(tx.merchantAlias.delete).toHaveBeenCalledWith({
        where: { id: 'alias-1' },
      });
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('preview', () => {
    it('returns the total count and the samples, without saving', async () => {
      tx.$queryRaw.mockResolvedValue([
        {
          id: 't1',
          original: 'FARMACIA SAN PABLO',
          txnDate: new Date('2026-10-02'),
          amount: new Prisma.Decimal('120.5'),
          currency: 'MXN',
          total: BigInt(42),
        },
      ]);

      const preview = await service.preview(userId, input());

      expect(preview).toEqual({
        count: 42,
        samples: [
          {
            transactionId: 't1',
            original: 'FARMACIA SAN PABLO',
            date: new Date('2026-10-02'),
            amount: 120.5,
            currency: 'MXN',
          },
        ],
      });
      expect(rawTexts(tx.$executeRawUnsafe)).toEqual([
        "SET LOCAL statement_timeout = '5s'",
      ]);
      expect(tx.merchantAlias.create).not.toHaveBeenCalled();
      expect(tx.$executeRaw).not.toHaveBeenCalled();
    });

    it('is 0 when nothing matches', async () => {
      tx.$queryRaw.mockResolvedValue([]);
      await expect(service.preview(userId, input())).resolves.toEqual({
        count: 0,
        samples: [],
      });
    });
  });

  describe('applyTo (new movements)', () => {
    beforeEach(() => {
      tx.merchantAlias.count.mockResolvedValue(1);
      prisma.merchantAlias.count.mockResolvedValue(1);
    });

    it('runs inside the caller transaction behind a savepoint', async () => {
      await service.applyTo(userId, ['t1', 't2'], tx);

      expect(rawTexts(tx.$executeRawUnsafe)).toEqual([
        'SAVEPOINT apply_aliases',
        "SET LOCAL statement_timeout = '5s'",
        'SET LOCAL statement_timeout TO DEFAULT',
        'RELEASE SAVEPOINT apply_aliases',
      ]);
      const sql = tx.$executeRaw.mock.calls[0][0] as unknown as Prisma.Sql;
      expect(sql.values).toEqual([userId, ['t1', 't2']]);
    });

    it('never fails the import: rolls back to the savepoint and logs', async () => {
      tx.$executeRaw.mockRejectedValue(new Error('boom'));
      await expect(
        service.applyTo(userId, ['t1'], tx),
      ).resolves.toBeUndefined();
      expect(rawTexts(tx.$executeRawUnsafe)).toContain(
        'ROLLBACK TO SAVEPOINT apply_aliases',
      );
    });

    it('does nothing when the user has no active aliases', async () => {
      prisma.merchantAlias.count.mockResolvedValue(0);
      await service.applyTo(userId, ['t1']);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('without a transaction opens its own', async () => {
      await service.applyTo(userId, ['t1']);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    });
  });
});
