import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { OccurrenceStatus, RecurringFrequency } from '@finnit/database';

import { PrismaService } from '../../services/prisma.service';
import { RecurringExpensesService } from './recurring-expenses.service';
import {
  fitScore,
  monthsAround,
  namesMatch,
  rankExpenses,
  slotFor,
} from './recurring-links';
import { RecurringLinksService } from './recurring-links.service';
import { rhythmDatesBetween } from './schedule.util';

const day = (d: string) => new Date(`${d}T00:00:00Z`);

describe('recurring links: rules', () => {
  it('offers the months around the expense', () => {
    expect(monthsAround('2026-01')).toEqual([
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
  });

  it('keeps the rhythm before the start date', () => {
    // Registered from Nov 15: in October it would have been due the 15th.
    const rule = {
      frequency: RecurringFrequency.monthly,
      interval: 1,
      startDate: day('2026-11-15'),
    };
    expect(
      rhythmDatesBetween(rule, day('2026-10-01'), day('2026-10-31')),
    ).toEqual([day('2026-10-15')]);
    expect(
      rhythmDatesBetween(
        { ...rule, frequency: RecurringFrequency.weekly },
        day('2026-10-01'),
        day('2026-10-14'),
      ),
    ).toEqual([day('2026-10-04'), day('2026-10-11')]);
  });

  const occ = (over: Record<string, unknown>) => ({
    id: 'o1',
    dueDay: '2026-10-28',
    status: OccurrenceStatus.upcoming,
    hasMovement: false,
    expectedAmount: 159,
    ...over,
  });

  it("takes the month's open payment, one paid by hand, or a new one", () => {
    expect(slotFor('2026-10', [occ({})], [], '2026-10-23', 159)).toMatchObject({
      occurrenceId: 'o1',
      status: 'pending',
    });
    expect(
      slotFor(
        '2026-10',
        [occ({ status: OccurrenceStatus.paid })],
        [],
        '2026-10-23',
        159,
      ).status,
    ).toBe('paid_without_movement');
    expect(
      slotFor(
        '2026-10',
        [occ({ status: OccurrenceStatus.paid, hasMovement: true })],
        [],
        '2026-10-23',
        159,
      ).status,
    ).toBe('linked');
    // Not generated: its usual day, or the expense's when there is none.
    expect(
      slotFor('2026-10', [], ['2026-10-15'], '2026-10-23', 142.33),
    ).toEqual({
      month: '2026-10',
      dueDay: '2026-10-15',
      occurrenceId: null,
      expectedAmount: 142.33,
      status: 'unscheduled',
    });
    expect(slotFor('2026-09', [], [], '2026-10-31', 50).dueDay).toBe(
      '2026-09-30',
    );
  });

  it('fits within 10 days and a similar amount, the closest amount best', () => {
    const movement = { day: '2026-10-23', amount: 141 };
    const minecraft = fitScore(
      { dueDay: '2026-10-15', expectedAmount: 142.33, status: 'unscheduled' },
      movement,
      false,
    );
    const crunchyroll = fitScore(
      {
        dueDay: '2026-10-28',
        expectedAmount: 159,
        status: 'paid_without_movement',
      },
      movement,
      false,
    );
    expect(minecraft).not.toBeNull();
    expect(crunchyroll).not.toBeNull();
    expect(minecraft!).toBeLessThan(crunchyroll!);
    expect(
      fitScore(
        { dueDay: '2026-10-01', expectedAmount: 141, status: 'pending' },
        movement,
        false,
      ),
    ).toBeNull();
    expect(
      fitScore(
        { dueDay: '2026-10-23', expectedAmount: 141, status: 'linked' },
        movement,
        false,
      ),
    ).toBeNull();
  });

  it('lists the fitting ones first and proposes the best', () => {
    const { ranked, proposed } = rankExpenses(
      [
        { id: 'netflix', amount: 219, nameMatches: false, fit: null },
        { id: 'crunchyroll', amount: 159, nameMatches: false, fit: 1.35 },
        { id: 'minecraft', amount: 142.33, nameMatches: false, fit: 0.86 },
        { id: 'termius', amount: 53, nameMatches: false, fit: null },
      ],
      141,
    );
    expect(ranked.map((e) => e.id)).toEqual([
      'minecraft',
      'crunchyroll',
      'netflix',
      'termius',
    ]);
    expect(proposed).toBe('minecraft');
    expect(
      rankExpenses([{ id: 'a', amount: 1, nameMatches: true, fit: null }], 9)
        .proposed,
    ).toBeNull();
  });

  it('matches by pattern or by name, like the bank sync', () => {
    expect(
      namesMatch('NETFLIX.COM 866', { name: 'Netflix', merchantPattern: null }),
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

  const movement = {
    id: 'tx-1',
    userId: 'user-1',
    type: 'expense',
    amount: 141,
    currency: 'MXN',
    txnDate: day('2026-10-23'),
    accountId: 'a1',
    merchantName: 'MICROSOFT*MINECRAFT 800',
    description: null,
    recurringPayment: null,
    debtPayment: null,
  };
  const expense = (
    id: string,
    name: string,
    amount: number,
    start: string,
  ) => ({
    id,
    name,
    kind: 'subscription',
    amount,
    active: true,
    frequency: 'monthly',
    interval: 1,
    startDate: day(start),
    endDate: null,
    categoryId: `cat-${id}`,
    merchantPattern: null,
    isVariableAmount: false,
  });

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    recurring = mockDeep<RecurringExpensesService>();
    service = new RecurringLinksService(prisma, recurring);
    prisma.transaction.findFirst.mockResolvedValue(movement as never);
  });

  it('lists every recurring expense, the fitting ones first, even before their start', async () => {
    prisma.recurringExpense.findMany.mockResolvedValue([
      expense('crunchy', 'Crunchyroll', 159, '2026-01-28'),
      expense('minecraft', 'Minecraft Realm', 142.33, '2026-11-15'),
      expense('termius', 'Termius', 53, '2026-01-14'),
    ] as never);
    prisma.recurringOccurrence.findMany.mockResolvedValue([
      {
        id: 'c-oct',
        recurringExpenseId: 'crunchy',
        dueDate: day('2026-10-28'),
        status: 'paid',
        transactionId: null,
        expectedAmount: 159,
      },
    ] as never);

    const options = await service.options('user-1', 'tx-1');

    expect(options.month).toBe('2026-10');
    expect(options.months).toHaveLength(6);
    expect(options.proposedId).toBe('minecraft');
    expect(options.expenses.map((e) => [e.id, e.fits])).toEqual([
      ['minecraft', true],
      ['crunchy', true],
      ['termius', false],
    ]);
    const october = options.expenses[0].slots.find(
      (s) => s.month === '2026-10',
    );
    expect(october).toMatchObject({
      status: 'unscheduled',
      dueDate: day('2026-10-15'),
    });
  });

  it("creates the month's payment when it wasn't generated, pays it and categorizes", async () => {
    prisma.recurringExpense.findFirst.mockResolvedValue({
      ...expense('minecraft', 'Minecraft Realm', 142.33, '2026-11-15'),
      debtId: null,
      currency: 'MXN',
    } as never);
    prisma.recurringExpense.findMany.mockResolvedValue([] as never);
    prisma.recurringOccurrence.findMany.mockResolvedValue([] as never);
    prisma.recurringOccurrence.create.mockResolvedValue({ id: 'new' } as never);

    await service.link('user-1', 'tx-1', 'minecraft');

    expect(prisma.recurringOccurrence.create).toHaveBeenCalledWith({
      data: {
        recurringExpenseId: 'minecraft',
        dueDate: day('2026-10-15'),
        expectedAmount: 142.33,
      },
      select: { id: true },
    });
    expect(recurring.markOccurrencePaid).toHaveBeenCalledWith(
      'new',
      'user-1',
      'tx-1',
    );
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      data: {
        categoryId: 'cat-minecraft',
        categorySource: 'manual',
        suggestedCategoryId: null,
      },
    });
    // "Minecraft Realm" isn't in the bank text: it learns the text.
    expect(prisma.recurringExpense.update).toHaveBeenCalledWith({
      where: { id: 'minecraft' },
      data: { merchantPattern: 'MICROSOFT MINECRAFT' },
    });
  });

  it('pays another month when asked, and learns the bank text', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      ...movement,
      merchantName: 'PAYPAL *CRUNCHY 4029',
    } as never);
    prisma.recurringExpense.findFirst.mockResolvedValue({
      ...expense('crunchy', 'Crunchyroll', 159, '2026-01-28'),
      debtId: null,
      currency: 'MXN',
    } as never);
    prisma.recurringOccurrence.findMany.mockResolvedValue([
      {
        id: 'c-nov',
        recurringExpenseId: 'crunchy',
        dueDate: day('2026-11-28'),
        status: 'upcoming',
        transactionId: null,
        expectedAmount: 159,
      },
    ] as never);

    await service.link('user-1', 'tx-1', 'crunchy', '2026-11');

    expect(recurring.markOccurrencePaid).toHaveBeenCalledWith(
      'c-nov',
      'user-1',
      'tx-1',
    );
    expect(prisma.recurringExpense.update).toHaveBeenCalledWith({
      where: { id: 'crunchy' },
      data: { merchantPattern: 'PAYPAL CRUNCHY' },
    });
  });

  it('gives a payment paid by hand its movement, and refuses one already paid with another', async () => {
    prisma.recurringExpense.findFirst.mockResolvedValue({
      ...expense('crunchy', 'Crunchyroll', 159, '2026-01-28'),
      debtId: null,
      currency: 'MXN',
    } as never);
    const october = {
      id: 'c-oct',
      recurringExpenseId: 'crunchy',
      dueDate: day('2026-10-28'),
      status: 'paid',
      transactionId: null,
      expectedAmount: 159,
    };
    prisma.recurringOccurrence.findMany.mockResolvedValueOnce([
      october,
    ] as never);

    await service.link('user-1', 'tx-1', 'crunchy');

    expect(recurring.markOccurrencePaid).not.toHaveBeenCalled();
    expect(prisma.recurringOccurrence.update).toHaveBeenCalledWith({
      where: { id: 'c-oct' },
      data: { transactionId: 'tx-1', matchedBy: 'manual' },
    });

    prisma.recurringOccurrence.findMany.mockResolvedValueOnce([
      { ...october, transactionId: 'other' },
    ] as never);
    await expect(service.link('user-1', 'tx-1', 'crunchy')).rejects.toThrow(
      'already has its movement',
    );
  });

  it('refuses income, loans and expenses already linked', async () => {
    prisma.transaction.findFirst.mockResolvedValueOnce({
      ...movement,
      type: 'income',
    } as never);
    await expect(service.options('user-1', 'tx-1')).rejects.toThrow(
      'Only expenses',
    );
    prisma.transaction.findFirst.mockResolvedValueOnce({
      ...movement,
      recurringPayment: { id: 'x' },
    } as never);
    await expect(service.options('user-1', 'tx-1')).rejects.toThrow(
      'already pays',
    );
    prisma.recurringExpense.findFirst.mockResolvedValueOnce({
      ...expense('loan', 'Préstamo', 1000, '2026-01-01'),
      debtId: 'd1',
      currency: 'MXN',
    } as never);
    await expect(service.link('user-1', 'tx-1', 'loan')).rejects.toThrow(
      'from the loan',
    );
  });
});
