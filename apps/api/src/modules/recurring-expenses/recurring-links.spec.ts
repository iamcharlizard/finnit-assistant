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
    sameAccount: false,
    nameMatches: false,
    ...over,
  });

  it('proposes the payment due near the day with the same amount', () => {
    const { ranked, proposed } = rankLinkCandidates(
      [
        candidate({ occurrenceId: 'far', dueDay: '2026-10-08' }),
        candidate({ occurrenceId: 'near', dueDay: '2026-11-06' }),
      ],
      movement,
    );
    expect(ranked.map((c) => c.occurrenceId)).toEqual(['near', 'far']);
    expect(proposed).toBe('near');
  });

  it('proposes nothing when nothing is close', () => {
    const { proposed } = rankLinkCandidates(
      [candidate({ dueDay: '2026-10-01', expectedAmount: 500 })],
      movement,
    );
    expect(proposed).toBeNull();
  });

  it('matches by pattern or name, without accents or case', () => {
    expect(
      namesMatch('NETFLIX.COM 866', { name: 'Netflix', merchantPattern: null }),
    ).toBe(true);
    expect(
      namesMatch('Gimnasio Spórt', { name: 'Gym', merchantPattern: 'sport' }),
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
    prisma.recurringOccurrence.findMany.mockResolvedValue([
      {
        id: 'occ-1',
        dueDate: new Date('2026-11-07T00:00:00Z'),
        expectedAmount: 219,
        status: 'upcoming',
        recurringExpense: {
          id: 'rec-1',
          name: 'Netflix',
          kind: 'subscription',
          accountId: 'a1',
          merchantPattern: null,
          categoryId: 'streaming',
        },
      },
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

  it('marks the payment paid and gives the expense its category', async () => {
    prisma.transaction.findFirst.mockResolvedValue(expense as never);
    prisma.recurringOccurrence.findFirst.mockResolvedValue({
      id: 'occ-1',
      recurringExpense: { debtId: null, categoryId: 'streaming' },
    } as never);

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
    prisma.recurringOccurrence.findFirst.mockResolvedValueOnce({
      id: 'occ-2',
      recurringExpense: { debtId: 'd1', categoryId: null },
    } as never);
    await expect(service.link('user-1', 'tx-1', 'occ-2')).rejects.toThrow(
      'from the loan',
    );
    expect(recurring.markOccurrencePaid).not.toHaveBeenCalled();
  });
});
