import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import {
  OccurrenceMatchSource,
  OccurrenceStatus,
  Prisma,
  RecurringExpenseKind,
  RecurringFrequency,
  RecurringTrackingMode,
} from '@finnit/database';
import { RecurringExpensesService } from './recurring-expenses.service';
import { PrismaService } from '../../services/prisma.service';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('RecurringExpensesService', () => {
  let service: RecurringExpensesService;
  let prisma: DeepMockProxy<PrismaService>;

  const userId = 'user-1';

  const expenseRow = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'rec-1',
      userId,
      name: 'Netflix',
      kind: RecurringExpenseKind.subscription,
      trackingMode: RecurringTrackingMode.automatic,
      frequency: RecurringFrequency.monthly,
      interval: 1,
      startDate: d('2026-01-10'),
      endDate: null,
      amount: new Prisma.Decimal(299),
      isVariableAmount: false,
      currency: 'MXN',
      accountId: 'card-1',
      categoryId: null,
      debtId: null,
      merchantPattern: 'NETFLIX',
      installmentsTotal: null,
      installmentsPaid: 0,
      active: true,
      notes: null,
      nextDueDate: d('2026-10-10'),
      createdAt: d('2026-01-01'),
      updatedAt: d('2026-01-01'),
      ...overrides,
    }) as never;

  const occurrenceRow = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'occ-1',
      recurringExpenseId: 'rec-1',
      dueDate: d('2026-10-10'),
      expectedAmount: new Prisma.Decimal(299),
      status: OccurrenceStatus.upcoming,
      transactionId: null,
      paidAt: null,
      matchedBy: null,
      createdAt: d('2026-09-01'),
      updatedAt: d('2026-09-01'),
      ...overrides,
    }) as never;

  const baseInput = {
    name: 'Netflix',
    kind: RecurringExpenseKind.subscription,
    trackingMode: RecurringTrackingMode.automatic,
    frequency: RecurringFrequency.monthly,
    startDate: d('2026-01-10'),
    amount: 299,
  };

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date('2026-10-05T15:00:00.000Z') });
    prisma = mockDeep<PrismaService>();
    prisma.$transaction.mockImplementation(
      (fn: unknown) => (fn as (tx: unknown) => unknown)(prisma) as never,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringExpensesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(RecurringExpensesService);
  });

  afterEach(() => jest.useRealTimers());

  describe('create', () => {
    it('creates the expense with the next due date and generates occurrences', async () => {
      prisma.recurringExpense.create.mockResolvedValue(expenseRow());
      prisma.recurringOccurrence.createMany.mockResolvedValue({ count: 4 });

      const result = await service.create(userId, {
        ...baseInput,
        merchantPattern: '  netflix ',
      });

      expect(prisma.recurringExpense.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          name: 'Netflix',
          interval: 1,
          currency: 'MXN',
          merchantPattern: 'NETFLIX',
          nextDueDate: d('2026-10-10'),
        }),
      });
      // Lookback of 62 days (Aug 4) to a 60-day horizon (Dec 4).
      const { data } = prisma.recurringOccurrence.createMany.mock
        .calls[0][0] as {
        data: { dueDate: Date }[];
      };
      expect(data.map((o) => o.dueDate.toISOString().slice(0, 10))).toEqual([
        '2026-08-10',
        '2026-09-10',
        '2026-10-10',
        '2026-11-10',
      ]);
      expect(result.monthlyCost).toBe(299);
    });

    it('does not generate occurrences for reminder-only expenses', async () => {
      prisma.recurringExpense.create.mockResolvedValue(
        expenseRow({ trackingMode: RecurringTrackingMode.reminder }),
      );

      await service.create(userId, {
        ...baseInput,
        trackingMode: RecurringTrackingMode.reminder,
      });

      expect(prisma.recurringOccurrence.createMany).not.toHaveBeenCalled();
    });

    it.each([
      [{ amount: 0 }, 'Amount must be greater than zero'],
      [{ amount: -5 }, 'Amount must be greater than zero'],
      [{ interval: 13 }, 'Interval must be an integer between 1 and 12'],
      [
        { endDate: d('2025-12-31') },
        'End date must be on or after the start date',
      ],
      [
        { kind: RecurringExpenseKind.installment },
        'Installment expenses need the total number of installments',
      ],
      [
        {
          kind: RecurringExpenseKind.installment,
          installmentsTotal: 6,
          installmentsPaid: 7,
        },
        'Paid installments cannot exceed the total installments',
      ],
    ])('rejects invalid input %p', async (overrides, message) => {
      await expect(
        service.create(userId, { ...baseInput, ...overrides }),
      ).rejects.toThrow(new ValidationError(message));
      expect(prisma.recurringExpense.create).not.toHaveBeenCalled();
    });

    it("rejects an account that isn't the user's", async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(
        service.create(userId, { ...baseInput, accountId: 'other' }),
      ).rejects.toThrow(NotFoundError);
      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: { id: 'other', userId },
        select: { id: true },
      });
    });

    it('rejects a debt already paid by another recurring expense', async () => {
      prisma.debt.findFirst.mockResolvedValue({
        id: 'debt-1',
        recurringExpense: { id: 'rec-other' },
      } as never);

      await expect(
        service.create(userId, { ...baseInput, debtId: 'debt-1' }),
      ).rejects.toThrow(ConflictError);
    });

    it('maps a duplicate name to a ConflictError', async () => {
      prisma.recurringExpense.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.create(userId, baseInput)).rejects.toThrow(
        ConflictError,
      );
    });
  });

  describe('findMany', () => {
    it('lists active expenses ordered by name with a native cursor', async () => {
      prisma.recurringExpense.findMany.mockResolvedValue([expenseRow()]);
      prisma.recurringExpense.count.mockResolvedValue(3);
      const after = Buffer.from('rec-0').toString('base64');

      const result = await service.findMany(userId, {
        first: 1,
        after,
        kind: RecurringExpenseKind.subscription,
      });

      expect(prisma.recurringExpense.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          active: true,
          kind: RecurringExpenseKind.subscription,
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: 1,
        cursor: { id: 'rec-0' },
        skip: 1,
      });
      expect(result.totalCount).toBe(3);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.edges[0].node.name).toBe('Netflix');
    });
  });

  describe('update', () => {
    it('regenerates upcoming occurrences when the schedule changes', async () => {
      prisma.recurringExpense.findFirst.mockResolvedValue(expenseRow());
      prisma.recurringExpense.update.mockResolvedValue(
        expenseRow({ startDate: d('2026-01-20') }),
      );
      prisma.recurringOccurrence.createMany.mockResolvedValue({ count: 2 });

      await service.update('rec-1', userId, { startDate: d('2026-01-20') });

      expect(prisma.recurringOccurrence.deleteMany).toHaveBeenCalledWith({
        where: {
          recurringExpenseId: 'rec-1',
          status: OccurrenceStatus.upcoming,
        },
      });
      expect(prisma.recurringExpense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ nextDueDate: d('2026-10-20') }),
        }),
      );
    });

    it('keeps occurrences when only the name changes', async () => {
      prisma.recurringExpense.findFirst.mockResolvedValue(expenseRow());
      prisma.recurringExpense.update.mockResolvedValue(
        expenseRow({ name: 'Netflix Premium' }),
      );
      prisma.recurringOccurrence.createMany.mockResolvedValue({ count: 0 });

      await service.update('rec-1', userId, { name: 'Netflix Premium' });

      expect(prisma.recurringOccurrence.deleteMany).not.toHaveBeenCalled();
      expect(prisma.recurringOccurrence.updateMany).not.toHaveBeenCalled();
    });

    it('updates the expected amount of future upcoming occurrences', async () => {
      prisma.recurringExpense.findFirst.mockResolvedValue(expenseRow());
      prisma.recurringExpense.update.mockResolvedValue(
        expenseRow({ amount: new Prisma.Decimal(329) }),
      );
      prisma.recurringOccurrence.createMany.mockResolvedValue({ count: 0 });

      await service.update('rec-1', userId, { amount: 329 });

      expect(prisma.recurringOccurrence.updateMany).toHaveBeenCalledWith({
        where: {
          recurringExpenseId: 'rec-1',
          status: OccurrenceStatus.upcoming,
          dueDate: { gte: d('2026-10-05') },
        },
        data: { expectedAmount: 329 },
      });
    });

    it('throws NotFoundError for another user expense', async () => {
      prisma.recurringExpense.findFirst.mockResolvedValue(null);
      await expect(
        service.update('rec-1', userId, { name: 'x' }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('markOccurrencePaid', () => {
    it('marks a manual payment as paid and links the transaction', async () => {
      prisma.recurringOccurrence.findFirst.mockResolvedValue({
        ...(occurrenceRow() as object),
        recurringExpense: expenseRow({
          trackingMode: RecurringTrackingMode.manual,
        }),
      } as never);
      prisma.transaction.findFirst.mockResolvedValue({
        id: 'txn-1',
        recurringPayment: null,
      } as never);
      prisma.recurringOccurrence.update.mockResolvedValue(
        occurrenceRow({
          status: OccurrenceStatus.paid,
          transactionId: 'txn-1',
        }),
      );

      const result = await service.markOccurrencePaid('occ-1', userId, 'txn-1');

      expect(prisma.recurringOccurrence.update).toHaveBeenCalledWith({
        where: { id: 'occ-1' },
        data: expect.objectContaining({
          status: OccurrenceStatus.paid,
          matchedBy: OccurrenceMatchSource.manual,
          transactionId: 'txn-1',
        }),
      });
      expect(result.status).toBe(OccurrenceStatus.paid);
    });

    it('rejects a transaction that already pays another expense', async () => {
      prisma.recurringOccurrence.findFirst.mockResolvedValue({
        ...(occurrenceRow() as object),
        recurringExpense: expenseRow(),
      } as never);
      prisma.transaction.findFirst.mockResolvedValue({
        id: 'txn-1',
        recurringPayment: { id: 'occ-9' },
      } as never);

      await expect(
        service.markOccurrencePaid('occ-1', userId, 'txn-1'),
      ).rejects.toThrow(ConflictError);
    });

    it('rejects reminder-only expenses', async () => {
      prisma.recurringOccurrence.findFirst.mockResolvedValue({
        ...(occurrenceRow() as object),
        recurringExpense: expenseRow({
          trackingMode: RecurringTrackingMode.reminder,
        }),
      } as never);

      await expect(service.markOccurrencePaid('occ-1', userId)).rejects.toThrow(
        ValidationError,
      );
    });

    it('counts the installment and closes the plan on the last one', async () => {
      prisma.recurringOccurrence.findFirst.mockResolvedValue({
        ...(occurrenceRow() as object),
        recurringExpense: expenseRow({
          kind: RecurringExpenseKind.installment,
          installmentsTotal: 6,
          installmentsPaid: 5,
        }),
      } as never);
      prisma.recurringOccurrence.update.mockResolvedValue(
        occurrenceRow({ status: OccurrenceStatus.paid }),
      );

      await service.markOccurrencePaid('occ-1', userId);

      expect(prisma.recurringExpense.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: { installmentsPaid: 6, active: false },
      });
      expect(prisma.recurringOccurrence.deleteMany).toHaveBeenCalledWith({
        where: {
          recurringExpenseId: 'rec-1',
          status: OccurrenceStatus.upcoming,
          dueDate: { gt: d('2026-10-10') },
        },
      });
    });
  });

  describe('reopenOccurrence', () => {
    it('returns a paid installment to upcoming and gives the installment back', async () => {
      prisma.recurringOccurrence.findFirst.mockResolvedValue({
        ...(occurrenceRow({ status: OccurrenceStatus.paid }) as object),
        recurringExpense: expenseRow({
          kind: RecurringExpenseKind.installment,
          installmentsTotal: 6,
          installmentsPaid: 6,
          active: false,
        }),
      } as never);
      prisma.recurringOccurrence.update.mockResolvedValue(occurrenceRow());

      await service.reopenOccurrence('occ-1', userId);

      expect(prisma.recurringExpense.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: { installmentsPaid: 5, active: true },
      });
      expect(prisma.recurringOccurrence.update).toHaveBeenCalledWith({
        where: { id: 'occ-1' },
        data: {
          status: OccurrenceStatus.upcoming,
          paidAt: null,
          matchedBy: null,
          transactionId: null,
        },
      });
    });
  });

  describe('upcomingPayments', () => {
    it('combines stored occurrences with computed reminder dates', async () => {
      prisma.recurringExpense.findMany.mockResolvedValue([
        expenseRow(),
        expenseRow({
          id: 'rec-2',
          name: 'Renta',
          trackingMode: RecurringTrackingMode.reminder,
          startDate: d('2026-01-01'),
          amount: new Prisma.Decimal(12000),
        }),
      ]);
      prisma.recurringOccurrence.createMany.mockResolvedValue({ count: 0 });
      prisma.recurringOccurrence.findMany.mockResolvedValue([occurrenceRow()]);

      const result = await service.upcomingPayments(userId, {
        from: d('2026-10-01'),
        to: d('2026-10-31'),
      });

      const rows = result.map((p) => [
        p.recurringExpense.name,
        p.dueDate.toISOString().slice(0, 10),
        p.occurrenceId,
        p.status,
      ]);
      expect(rows).toEqual([
        ['Renta', '2026-10-01', undefined, undefined],
        ['Netflix', '2026-10-10', 'occ-1', OccurrenceStatus.upcoming],
      ]);
      // Reminder-only expenses never get stored occurrences.
      expect(prisma.recurringOccurrence.findMany).toHaveBeenCalledWith({
        where: {
          recurringExpenseId: { in: ['rec-1'] },
          dueDate: { gte: d('2026-10-01'), lte: d('2026-10-31') },
        },
      });
    });

    it('rejects ranges longer than 400 days', async () => {
      await expect(
        service.upcomingPayments(userId, {
          from: d('2026-01-01'),
          to: d('2027-06-01'),
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('summary', () => {
    it('normalizes costs per month by kind and account', async () => {
      prisma.recurringExpense.findMany.mockResolvedValue([
        { ...(expenseRow() as object), account: { name: 'Banamex Oro' } },
        {
          ...(expenseRow({
            id: 'rec-2',
            name: 'Gimnasio',
            kind: RecurringExpenseKind.membership,
            frequency: RecurringFrequency.weekly,
            amount: new Prisma.Decimal(150),
            accountId: null,
          }) as object),
          account: null,
        },
      ] as never);

      const result = await service.summary(userId);

      expect(result.totals).toEqual([{ currency: 'MXN', monthlyCost: 949 }]);
      expect(result.byKind).toEqual([
        {
          kind: RecurringExpenseKind.membership,
          currency: 'MXN',
          count: 1,
          monthlyCost: 650,
        },
        {
          kind: RecurringExpenseKind.subscription,
          currency: 'MXN',
          count: 1,
          monthlyCost: 299,
        },
      ]);
      expect(result.byAccount[1]).toEqual({
        accountId: 'card-1',
        accountName: 'Banamex Oro',
        currency: 'MXN',
        count: 1,
        monthlyCost: 299,
      });
    });
  });

  describe('runDailyMaintenance', () => {
    it('generates occurrences, marks manual ones missed and creates new reminders only', async () => {
      prisma.recurringExpense.findMany.mockResolvedValue([
        expenseRow(),
        expenseRow({
          id: 'rec-2',
          name: 'Renta',
          trackingMode: RecurringTrackingMode.manual,
          startDate: d('2026-01-07'),
          nextDueDate: d('2026-10-07'),
        }),
      ]);
      prisma.recurringOccurrence.createMany.mockResolvedValue({ count: 1 });
      prisma.recurringOccurrence.updateMany.mockResolvedValue({ count: 2 });
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.createMany.mockResolvedValue({ count: 1 });

      const result = await service.runDailyMaintenance();

      expect(result).toEqual({ generated: 2, missed: 2, notified: 1 });
      expect(prisma.recurringOccurrence.updateMany).toHaveBeenCalledWith({
        where: {
          status: OccurrenceStatus.upcoming,
          dueDate: { lt: d('2026-10-02') },
          recurringExpense: { trackingMode: RecurringTrackingMode.manual },
        },
        data: { status: OccurrenceStatus.missed },
      });
      // Only the manual expense (due Oct 7, within 3 days) gets a reminder.
      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            userId,
            relatedEntityType: 'recurring_expense_due',
            relatedEntityId: 'rec-2:2026-10-07',
          }),
        ],
      });
    });

    it('does not duplicate reminders already created', async () => {
      prisma.recurringExpense.findMany.mockResolvedValue([
        expenseRow({
          id: 'rec-2',
          trackingMode: RecurringTrackingMode.manual,
          startDate: d('2026-01-07'),
          nextDueDate: d('2026-10-07'),
        }),
      ]);
      prisma.recurringOccurrence.createMany.mockResolvedValue({ count: 0 });
      prisma.recurringOccurrence.updateMany.mockResolvedValue({ count: 0 });
      prisma.notification.findMany.mockResolvedValue([
        { relatedEntityId: 'rec-2:2026-10-07' },
      ] as never);

      const result = await service.runDailyMaintenance();

      expect(result.notified).toBe(0);
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });
  });
});
