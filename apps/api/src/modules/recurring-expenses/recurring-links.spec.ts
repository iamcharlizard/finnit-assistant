import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { PrismaService } from '../../services/prisma.service';
import { RecurringExpensesService } from './recurring-expenses.service';
import { namesMatch, rankLinkCandidates } from './recurring-links';
import { RecurringLinksService } from './recurring-links.service';

describe('recurring links: ranking', () => {
  const movement = { day: '2026-11-08', amount: 219 };
  const candidate = (over: Record<string, unknown>) => ({
    occurrenceId: 'o',
    dueDay: '2026-11-08',
    expectedAmount: 219,
    isVariableAmount: false,
    sameAccount: false,
    nameMatches: false,
    ...over,
  });

  it('offers only payments due near the day with a similar amount', () => {
    const { ranked } = rankLinkCandidates(
      [
        candidate({ occurrenceId: 'month-before', dueDay: '2026-10-08' }),
        candidate({ occurrenceId: 'other-amount', expectedAmount: 53 }),
        candidate({ occurrenceId: 'near', dueDay: '2026-11-03' }),
        candidate({ occurrenceId: 'closer', dueDay: '2026-11-07' }),
        // A variable bill fits within 50%.
        candidate({
          occurrenceId: 'variable',
          expectedAmount: 300,
          isVariableAmount: true,
        }),
      ],
      movement,
    );
    expect(ranked.map((c) => c.occurrenceId)).toEqual([
      'variable',
      'closer',
      'near',
    ]);
  });

  it('puts the one its text names first, and proposes it', () => {
    const { ranked, proposed } = rankLinkCandidates(
      [
        candidate({ occurrenceId: 'same-day' }),
        candidate({
          occurrenceId: 'named',
          dueDay: '2026-11-02',
          nameMatches: true,
        }),
      ],
      movement,
    );
    expect(ranked[0].occurrenceId).toBe('named');
    expect(proposed).toBe('named');
  });

  it('proposes the only candidate, and none among several unnamed', () => {
    expect(rankLinkCandidates([candidate({})], movement).proposed).toBe('o');
    expect(
      rankLinkCandidates(
        [candidate({ occurrenceId: 'a' }), candidate({ occurrenceId: 'b' })],
        movement,
      ).proposed,
    ).toBeNull();
  });

  it('matches by pattern or by name, like the bank sync', () => {
    expect(
      namesMatch('NETFLIX.COM 866', { name: 'Netflix', merchantPattern: null }),
    ).toBe(true);
    expect(
      namesMatch('PAYPAL *SPORTCLUB', {
        name: 'Gimnasio',
        merchantPattern: 'SPORTCLUB',
      }),
    ).toBe(true);
    expect(namesMatch('OXXO', { name: 'Netflix', merchantPattern: null })).toBe(
      false,
    );
  });
});

describe('RecurringLinksService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let recurring: DeepMockProxy<RecurringExpensesService>;
  let service: RecurringLinksService;

  const expense = {
    id: 'tx-1',
    userId: 'user-1',
    type: 'expense',
    amount: 219,
    currency: 'MXN',
    txnDate: new Date('2026-11-08T00:00:00Z'),
    accountId: 'a1',
    merchantName: 'NETFLIX.COM',
    description: null,
    aliasName: null,
    recurringPayment: null,
    debtPayment: null,
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    recurring = mockDeep<RecurringExpensesService>();
    service = new RecurringLinksService(prisma, recurring);
  });

  it('offers the scheduled payments, the clear one proposed', async () => {
    prisma.transaction.findFirst.mockResolvedValue(expense as never);
    const occurrence = (id: string, dueDate: string, amount: number) => ({
      id,
      dueDate: new Date(`${dueDate}T00:00:00Z`),
      expectedAmount: amount,
      status: 'upcoming',
      recurringExpense: {
        id: `rec-${id}`,
        name: id === 'occ-1' ? 'Netflix' : 'Termius',
        kind: 'subscription',
        accountId: 'a1',
        merchantPattern: null,
        categoryId: 'streaming',
        isVariableAmount: false,
      },
    });
    prisma.recurringOccurrence.findMany.mockResolvedValue([
      occurrence('occ-1', '2026-11-07', 219),
      // Another amount: not offered.
      occurrence('occ-2', '2026-11-08', 53),
    ] as never);

    const options = await service.options('user-1', 'tx-1');

    expect(options).toEqual([
      expect.objectContaining({
        occurrenceId: 'occ-1',
        name: 'Netflix',
        categoryId: 'streaming',
        proposed: true,
      }),
    ]);
    const where = prisma.recurringOccurrence.findMany.mock.calls[0][0]!.where!;
    expect(where).toMatchObject({
      transactionId: null,
      recurringExpense: { userId: 'user-1', debtId: null, currency: 'MXN' },
    });
  });

  const linked = (over: Record<string, unknown> = {}) => ({
    id: 'occ-1',
    status: 'upcoming',
    transactionId: null,
    recurringExpense: {
      id: 'rec-1',
      name: 'Netflix',
      debtId: null,
      categoryId: 'streaming',
      merchantPattern: null,
    },
    ...over,
  });

  it('marks the payment paid and gives the expense its category', async () => {
    prisma.transaction.findFirst.mockResolvedValue(expense as never);
    prisma.recurringOccurrence.findFirst.mockResolvedValue(linked() as never);

    await service.link('user-1', 'tx-1', 'occ-1');

    expect(recurring.markOccurrencePaid).toHaveBeenCalledWith(
      'occ-1',
      'user-1',
      'tx-1',
    );
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      data: {
        categoryId: 'streaming',
        categorySource: 'manual',
        suggestedCategoryId: null,
      },
    });
    // The text already names it: nothing to learn.
    expect(prisma.recurringExpense.update).not.toHaveBeenCalled();
  });

  it('learns the bank text so the next syncs link by themselves', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      ...expense,
      merchantName: 'PAYPAL *NFX 4029357733',
    } as never);
    prisma.recurringOccurrence.findFirst.mockResolvedValue(linked() as never);

    await service.link('user-1', 'tx-1', 'occ-1');

    expect(prisma.recurringExpense.update).toHaveBeenCalledWith({
      where: { id: 'rec-1' },
      data: { merchantPattern: 'PAYPAL NFX' },
    });
  });

  it('gives a payment marked paid by hand its movement', async () => {
    prisma.transaction.findFirst.mockResolvedValue(expense as never);
    prisma.recurringOccurrence.findFirst.mockResolvedValue(
      linked({ status: 'paid' }) as never,
    );

    await service.link('user-1', 'tx-1', 'occ-1');

    expect(recurring.markOccurrencePaid).not.toHaveBeenCalled();
    expect(prisma.recurringOccurrence.update).toHaveBeenCalledWith({
      where: { id: 'occ-1' },
      data: { transactionId: 'tx-1', matchedBy: 'manual' },
    });
  });

  it('refuses income, loans and expenses already linked', async () => {
    prisma.transaction.findFirst.mockResolvedValueOnce({
      ...expense,
      type: 'income',
    } as never);
    await expect(service.options('user-1', 'tx-1')).rejects.toThrow(
      'Only expenses',
    );
    prisma.transaction.findFirst.mockResolvedValueOnce({
      ...expense,
      recurringPayment: { id: 'x' },
    } as never);
    await expect(service.options('user-1', 'tx-1')).rejects.toThrow(
      'already pays',
    );
    prisma.transaction.findFirst.mockResolvedValueOnce(expense as never);
    prisma.recurringOccurrence.findFirst.mockResolvedValueOnce(
      linked({
        recurringExpense: {
          id: 'r2',
          name: 'Préstamo',
          debtId: 'd1',
          categoryId: null,
          merchantPattern: null,
        },
      }) as never,
    );
    await expect(service.link('user-1', 'tx-1', 'occ-2')).rejects.toThrow(
      'from the loan',
    );
    expect(recurring.markOccurrencePaid).not.toHaveBeenCalled();
  });
});
