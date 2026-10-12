import { Injectable } from '@nestjs/common';
import {
  NotificationType,
  OccurrenceMatchSource,
  OccurrenceStatus,
  Prisma,
  RecurringExpenseKind,
  RecurringTrackingMode,
  type RecurringExpense as RecurringExpenseRow,
  type RecurringOccurrence as RecurringOccurrenceRow,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { PaginationUtil } from '../../common/utils/pagination.util';
import {
  CreateRecurringExpenseInput,
  RecurringExpense,
  RecurringExpenseConnection,
  RecurringExpensesArgs,
  RecurringExpensesSummary,
  RecurringOccurrence,
  UpcomingPayment,
  UpcomingPaymentsArgs,
  UpdateRecurringExpenseInput,
} from './dto/recurring-expense.dto';
import {
  addDays,
  dueDatesBetween,
  monthlyEquivalent,
  nextDueDate,
  toDateOnly,
} from './schedule.util';

// Occurrences are kept from this many days back, so last month's card
// statement can still be reconciled against them.
export const OCCURRENCE_LOOKBACK_DAYS = 62;
export const OCCURRENCE_HORIZON_DAYS = 60;
// A manual occurrence becomes `missed` this many days after its due date.
export const MISSED_GRACE_DAYS = 3;
// Manual and reminder expenses are notified this many days ahead.
export const REMINDER_DAYS_AHEAD = 3;
const MAX_UPCOMING_RANGE_DAYS = 400;

@Injectable()
export class RecurringExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    input: CreateRecurringExpenseInput,
  ): Promise<RecurringExpense> {
    const startDate = toDateOnly(new Date(input.startDate));
    const endDate = input.endDate ? toDateOnly(new Date(input.endDate)) : null;
    const interval = input.interval ?? 1;

    this.validateRule({
      amount: input.amount,
      interval,
      startDate,
      endDate,
      kind: input.kind,
      installmentsTotal: input.installmentsTotal ?? null,
      installmentsPaid: input.installmentsPaid ?? 0,
    });
    await this.validateReferences(userId, input);

    const next = nextDueDate(
      { frequency: input.frequency, interval, startDate, endDate },
      this.today(),
    );

    try {
      const expense = await this.prisma.recurringExpense.create({
        data: {
          userId,
          name: input.name.trim(),
          kind: input.kind,
          trackingMode: input.trackingMode,
          frequency: input.frequency,
          interval,
          startDate,
          endDate,
          amount: input.amount,
          isVariableAmount: input.isVariableAmount ?? false,
          currency: (input.currency ?? 'MXN').toUpperCase(),
          accountId: input.accountId,
          categoryId: input.categoryId,
          debtId: input.debtId,
          merchantPattern: this.normalizePattern(input.merchantPattern),
          installmentsTotal: input.installmentsTotal,
          installmentsPaid: input.installmentsPaid ?? 0,
          notes: input.notes,
          nextDueDate: next,
        },
      });

      await this.syncOccurrences(expense);
      return this.mapExpense(expense);
    } catch (error) {
      this.rethrowUniqueViolation(error);
      throw error;
    }
  }

  async findMany(
    userId: string,
    args: RecurringExpensesArgs,
  ): Promise<RecurringExpenseConnection> {
    const where: Prisma.RecurringExpenseWhereInput = {
      userId,
      active: args.active ?? true,
      ...(args.kind && { kind: args.kind }),
      ...(args.trackingMode && { trackingMode: args.trackingMode }),
      ...(args.accountId && { accountId: args.accountId }),
    };
    const first = args.first ?? 20;

    const [rows, totalCount] = await Promise.all([
      this.prisma.recurringExpense.findMany({
        where,
        // `id` breaks ties so the cursor order is stable.
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: first,
        ...(args.after && {
          cursor: { id: PaginationUtil.decodeCursor(args.after) },
          skip: 1,
        }),
      }),
      this.prisma.recurringExpense.count({ where }),
    ]);

    return PaginationUtil.createConnection(
      rows.map((row) => this.mapExpense(row)),
      { first, after: args.after },
      totalCount,
      (expense) => PaginationUtil.encodeCursor(expense.id),
    );
  }

  async findById(id: string, userId: string): Promise<RecurringExpense> {
    return this.mapExpense(await this.getOwned(id, userId));
  }

  async update(
    id: string,
    userId: string,
    input: UpdateRecurringExpenseInput,
  ): Promise<RecurringExpense> {
    const current = await this.getOwned(id, userId);

    const startDate = input.startDate
      ? toDateOnly(new Date(input.startDate))
      : current.startDate;
    const endDate =
      input.endDate !== undefined
        ? input.endDate && toDateOnly(new Date(input.endDate))
        : current.endDate;
    const frequency = input.frequency ?? current.frequency;
    const interval = input.interval ?? current.interval;
    const kind = input.kind ?? current.kind;

    this.validateRule({
      amount: input.amount ?? Number(current.amount),
      interval,
      startDate,
      endDate,
      kind,
      installmentsTotal: input.installmentsTotal ?? current.installmentsTotal,
      installmentsPaid: input.installmentsPaid ?? current.installmentsPaid,
    });
    await this.validateReferences(userId, input, id);

    const scheduleChanged =
      input.frequency !== undefined ||
      input.interval !== undefined ||
      input.startDate !== undefined ||
      input.endDate !== undefined ||
      (input.trackingMode !== undefined &&
        input.trackingMode !== current.trackingMode);

    try {
      const expense = await this.prisma.$transaction(async (tx) => {
        if (scheduleChanged) {
          // Unpaid occurrences (past ones still waiting for a statement too)
          // follow the old schedule: drop them and regenerate below. Paid,
          // skipped and missed ones are history and stay.
          await tx.recurringOccurrence.deleteMany({
            where: {
              recurringExpenseId: id,
              status: OccurrenceStatus.upcoming,
            },
          });
        }
        return tx.recurringExpense.update({
          where: { id },
          data: {
            name: input.name?.trim(),
            kind: input.kind,
            trackingMode: input.trackingMode,
            frequency: input.frequency,
            interval: input.interval,
            startDate,
            endDate,
            amount: input.amount,
            isVariableAmount: input.isVariableAmount,
            accountId: input.accountId,
            categoryId: input.categoryId,
            debtId: input.debtId,
            merchantPattern:
              input.merchantPattern !== undefined
                ? this.normalizePattern(input.merchantPattern)
                : undefined,
            installmentsTotal: input.installmentsTotal,
            installmentsPaid: input.installmentsPaid,
            active: input.active,
            notes: input.notes,
            nextDueDate: nextDueDate(
              { frequency, interval, startDate, endDate },
              this.today(),
            ),
          },
        });
      });

      // Pending occurrences keep the amount expected when they were generated.
      if (input.amount !== undefined) {
        await this.prisma.recurringOccurrence.updateMany({
          where: {
            recurringExpenseId: id,
            status: OccurrenceStatus.upcoming,
            dueDate: { gte: this.today() },
          },
          data: { expectedAmount: input.amount },
        });
      }

      await this.syncOccurrences(expense);
      return this.mapExpense(expense);
    } catch (error) {
      this.rethrowUniqueViolation(error);
      throw error;
    }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    await this.getOwned(id, userId);
    // Occurrences cascade; their transactions are kept.
    await this.prisma.recurringExpense.delete({ where: { id } });
    return true;
  }

  async occurrences(
    recurringExpenseId: string,
    userId: string,
    from?: Date,
    to?: Date,
  ): Promise<RecurringOccurrence[]> {
    await this.getOwned(recurringExpenseId, userId);
    const rows = await this.prisma.recurringOccurrence.findMany({
      where: {
        recurringExpenseId,
        dueDate: {
          ...(from && { gte: toDateOnly(new Date(from)) }),
          ...(to && { lte: toDateOnly(new Date(to)) }),
        },
      },
      orderBy: { dueDate: 'desc' },
    });
    return rows.map((row) => this.mapOccurrence(row));
  }

  /** Due payments in a date range, including reminder-only expenses. */
  async upcomingPayments(
    userId: string,
    args: UpcomingPaymentsArgs,
  ): Promise<UpcomingPayment[]> {
    const from = toDateOnly(new Date(args.from));
    const to = toDateOnly(new Date(args.to));
    if (to < from) {
      throw new ValidationError('`to` must be on or after `from`');
    }
    if (to.getTime() - from.getTime() > MAX_UPCOMING_RANGE_DAYS * 86_400_000) {
      throw new ValidationError(
        `The range cannot exceed ${MAX_UPCOMING_RANGE_DAYS} days`,
      );
    }

    const expenses = await this.prisma.recurringExpense.findMany({
      where: {
        userId,
        active: true,
        ...(args.accountId && { accountId: args.accountId }),
      },
    });
    const byId = new Map(expenses.map((e) => [e.id, this.mapExpense(e)]));
    const tracked = expenses.filter(
      (e) => e.trackingMode !== RecurringTrackingMode.reminder,
    );

    // Occurrences are normally generated by the daily job; make sure the
    // requested range exists so this query never misses one.
    await Promise.all(
      tracked.map((expense) => this.syncOccurrences(expense, from, to)),
    );

    const occurrences = await this.prisma.recurringOccurrence.findMany({
      where: {
        recurringExpenseId: { in: tracked.map((e) => e.id) },
        dueDate: { gte: from, lte: to },
      },
    });

    const payments: UpcomingPayment[] = occurrences.map((occurrence) => ({
      occurrenceId: occurrence.id,
      recurringExpense: byId.get(occurrence.recurringExpenseId)!,
      dueDate: occurrence.dueDate,
      expectedAmount: Number(occurrence.expectedAmount),
      status: occurrence.status,
    }));

    for (const expense of expenses) {
      if (expense.trackingMode !== RecurringTrackingMode.reminder) continue;
      for (const dueDate of dueDatesBetween(expense, from, to)) {
        payments.push({
          recurringExpense: byId.get(expense.id)!,
          dueDate,
          expectedAmount: Number(expense.amount),
        });
      }
    }

    return payments.sort(
      (a, b) =>
        a.dueDate.getTime() - b.dueDate.getTime() ||
        a.recurringExpense.name.localeCompare(b.recurringExpense.name),
    );
  }

  async summary(userId: string): Promise<RecurringExpensesSummary> {
    const expenses = await this.prisma.recurringExpense.findMany({
      where: { userId, active: true },
      include: { account: { select: { name: true } } },
    });

    const totals = new Map<string, number>();
    const byKind = new Map<
      string,
      {
        kind: RecurringExpenseKind;
        currency: string;
        count: number;
        monthlyCost: number;
      }
    >();
    const byAccount = new Map<
      string,
      {
        accountId?: string;
        accountName?: string;
        currency: string;
        count: number;
        monthlyCost: number;
      }
    >();

    for (const expense of expenses) {
      const cost = monthlyEquivalent(
        Number(expense.amount),
        expense.frequency,
        expense.interval,
      );
      const currency = expense.currency;
      totals.set(currency, (totals.get(currency) ?? 0) + cost);

      const kindKey = `${expense.kind}:${currency}`;
      const kindTotal = byKind.get(kindKey) ?? {
        kind: expense.kind,
        currency,
        count: 0,
        monthlyCost: 0,
      };
      kindTotal.count += 1;
      kindTotal.monthlyCost += cost;
      byKind.set(kindKey, kindTotal);

      const accountKey = `${expense.accountId ?? 'none'}:${currency}`;
      const accountTotal = byAccount.get(accountKey) ?? {
        accountId: expense.accountId ?? undefined,
        accountName: expense.account?.name,
        currency,
        count: 0,
        monthlyCost: 0,
      };
      accountTotal.count += 1;
      accountTotal.monthlyCost += cost;
      byAccount.set(accountKey, accountTotal);
    }

    const round = (value: number) => Math.round(value * 100) / 100;
    const byCost = (a: { monthlyCost: number }, b: { monthlyCost: number }) =>
      b.monthlyCost - a.monthlyCost;

    return {
      totals: [...totals].map(([currency, monthlyCost]) => ({
        currency,
        monthlyCost: round(monthlyCost),
      })),
      byKind: [...byKind.values()]
        .map((t) => ({ ...t, monthlyCost: round(t.monthlyCost) }))
        .sort(byCost),
      byAccount: [...byAccount.values()]
        .map((t) => ({ ...t, monthlyCost: round(t.monthlyCost) }))
        .sort(byCost),
    };
  }

  async markOccurrencePaid(
    occurrenceId: string,
    userId: string,
    transactionId?: string,
    matchedBy: OccurrenceMatchSource = OccurrenceMatchSource.manual,
  ): Promise<RecurringOccurrence> {
    const occurrence = await this.getOwnedOccurrence(occurrenceId, userId);
    if (occurrence.status === OccurrenceStatus.paid) {
      throw new ConflictError('This payment is already marked as paid');
    }

    if (transactionId) {
      const transaction = await this.prisma.transaction.findFirst({
        where: { id: transactionId, userId },
        include: { recurringPayment: { select: { id: true } } },
      });
      if (!transaction) {
        throw new NotFoundError('Transaction not found');
      }
      if (transaction.recurringPayment) {
        throw new ConflictError(
          'This transaction already pays another recurring expense',
        );
      }
    }

    const expense = occurrence.recurringExpense;
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.recurringOccurrence.update({
        where: { id: occurrenceId },
        data: {
          status: OccurrenceStatus.paid,
          paidAt: new Date(),
          matchedBy,
          transactionId: transactionId ?? null,
        },
      });

      if (expense.kind === RecurringExpenseKind.installment) {
        const installmentsPaid = expense.installmentsPaid + 1;
        const finished =
          expense.installmentsTotal !== null &&
          installmentsPaid >= expense.installmentsTotal;
        await tx.recurringExpense.update({
          where: { id: expense.id },
          data: { installmentsPaid, ...(finished && { active: false }) },
        });
        if (finished) {
          await tx.recurringOccurrence.deleteMany({
            where: {
              recurringExpenseId: expense.id,
              status: OccurrenceStatus.upcoming,
              dueDate: { gt: occurrence.dueDate },
            },
          });
        }
      }
      return row;
    });

    return this.mapOccurrence(updated);
  }

  async skipOccurrence(
    occurrenceId: string,
    userId: string,
  ): Promise<RecurringOccurrence> {
    const occurrence = await this.getOwnedOccurrence(occurrenceId, userId);
    if (occurrence.status === OccurrenceStatus.paid) {
      throw new ConflictError('Reopen the payment before skipping it');
    }
    const row = await this.prisma.recurringOccurrence.update({
      where: { id: occurrenceId },
      data: { status: OccurrenceStatus.skipped },
    });
    return this.mapOccurrence(row);
  }

  /** Undoes paid/skipped/missed: back to upcoming, unlinked from its transaction. */
  async reopenOccurrence(
    occurrenceId: string,
    userId: string,
  ): Promise<RecurringOccurrence> {
    const occurrence = await this.getOwnedOccurrence(occurrenceId, userId);
    const expense = occurrence.recurringExpense;

    const row = await this.prisma.$transaction(async (tx) => {
      if (
        occurrence.status === OccurrenceStatus.paid &&
        expense.kind === RecurringExpenseKind.installment &&
        expense.installmentsPaid > 0
      ) {
        await tx.recurringExpense.update({
          where: { id: expense.id },
          data: {
            installmentsPaid: expense.installmentsPaid - 1,
            active: true,
          },
        });
      }
      return tx.recurringOccurrence.update({
        where: { id: occurrenceId },
        data: {
          status: OccurrenceStatus.upcoming,
          paidAt: null,
          matchedBy: null,
          transactionId: null,
        },
      });
    });
    return this.mapOccurrence(row);
  }

  /**
   * Creates the missing occurrences of a tracked expense in [from, to].
   * Idempotent: existing occurrences (any status) are left untouched.
   */
  async syncOccurrences(
    expense: RecurringExpenseRow,
    from: Date = addDays(this.today(), -OCCURRENCE_LOOKBACK_DAYS),
    to: Date = addDays(this.today(), OCCURRENCE_HORIZON_DAYS),
  ): Promise<number> {
    if (
      !expense.active ||
      expense.trackingMode === RecurringTrackingMode.reminder
    ) {
      return 0;
    }
    const dueDates = dueDatesBetween(expense, from, to);
    if (dueDates.length === 0) return 0;

    const { count } = await this.prisma.recurringOccurrence.createMany({
      data: dueDates.map((dueDate) => ({
        recurringExpenseId: expense.id,
        dueDate,
        expectedAmount: expense.amount,
      })),
      skipDuplicates: true,
    });
    return count;
  }

  /**
   * Daily maintenance for every active expense: generate occurrences, mark
   * overdue manual payments as missed, refresh nextDueDate and create
   * reminder notifications.
   */
  async runDailyMaintenance(): Promise<{
    generated: number;
    missed: number;
    notified: number;
  }> {
    const today = this.today();
    const expenses = await this.prisma.recurringExpense.findMany({
      where: { active: true },
    });

    let generated = 0;
    for (const expense of expenses) {
      generated += await this.syncOccurrences(expense);
      const next = nextDueDate(expense, today);
      if (next?.getTime() !== expense.nextDueDate?.getTime()) {
        await this.prisma.recurringExpense.update({
          where: { id: expense.id },
          data: { nextDueDate: next },
        });
      }
    }

    // Automatic payments stay `upcoming` until a statement or bank movement
    // proves them; only manual ones can be declared missed.
    const { count: missed } = await this.prisma.recurringOccurrence.updateMany({
      where: {
        status: OccurrenceStatus.upcoming,
        dueDate: { lt: addDays(today, -MISSED_GRACE_DAYS) },
        recurringExpense: { trackingMode: RecurringTrackingMode.manual },
      },
      data: { status: OccurrenceStatus.missed },
    });

    const notified = await this.createReminders(expenses, today);
    return { generated, missed, notified };
  }

  private async createReminders(
    expenses: RecurringExpenseRow[],
    today: Date,
  ): Promise<number> {
    const until = addDays(today, REMINDER_DAYS_AHEAD);
    const reminders: Prisma.NotificationCreateManyInput[] = [];

    for (const expense of expenses) {
      if (expense.trackingMode === RecurringTrackingMode.automatic) continue;

      for (const dueDate of dueDatesBetween(expense, today, until)) {
        const day = dueDate.toISOString().slice(0, 10);
        reminders.push({
          userId: expense.userId,
          type: NotificationType.recurring,
          title: `${expense.name} vence el ${day}`,
          message: `Pago de ${expense.name}: ${Number(expense.amount).toFixed(2)} ${expense.currency}${expense.isVariableAmount ? ' (aprox.)' : ''}.`,
          scheduledAt: dueDate,
          relatedEntityType: 'recurring_expense_due',
          // One reminder per expense and due date.
          relatedEntityId: `${expense.id}:${day}`,
        });
      }
    }
    if (reminders.length === 0) return 0;

    const existing = await this.prisma.notification.findMany({
      where: {
        relatedEntityType: 'recurring_expense_due',
        relatedEntityId: { in: reminders.map((r) => r.relatedEntityId!) },
      },
      select: { relatedEntityId: true },
    });
    const seen = new Set(existing.map((n) => n.relatedEntityId));
    const fresh = reminders.filter((r) => !seen.has(r.relatedEntityId!));
    if (fresh.length === 0) return 0;

    const { count } = await this.prisma.notification.createMany({
      data: fresh,
    });
    return count;
  }

  private async getOwned(id: string, userId: string) {
    const expense = await this.prisma.recurringExpense.findFirst({
      where: { id, userId },
    });
    if (!expense) {
      throw new NotFoundError('Recurring expense not found');
    }
    return expense;
  }

  private async getOwnedOccurrence(id: string, userId: string) {
    const occurrence = await this.prisma.recurringOccurrence.findFirst({
      where: { id, recurringExpense: { userId } },
      include: { recurringExpense: true },
    });
    if (!occurrence) {
      throw new NotFoundError('Recurring payment not found');
    }
    if (
      occurrence.recurringExpense.trackingMode ===
      RecurringTrackingMode.reminder
    ) {
      throw new ValidationError('Reminder-only expenses have no payment state');
    }
    return occurrence;
  }

  private validateRule(rule: {
    amount: number;
    interval: number;
    startDate: Date;
    endDate: Date | null;
    kind: RecurringExpenseKind;
    installmentsTotal: number | null;
    installmentsPaid: number;
  }) {
    if (!(rule.amount > 0)) {
      throw new ValidationError('Amount must be greater than zero');
    }
    if (
      !Number.isInteger(rule.interval) ||
      rule.interval < 1 ||
      rule.interval > 12
    ) {
      throw new ValidationError('Interval must be an integer between 1 and 12');
    }
    if (rule.endDate && rule.endDate < rule.startDate) {
      throw new ValidationError('End date must be on or after the start date');
    }
    if (rule.kind === RecurringExpenseKind.installment) {
      if (!rule.installmentsTotal || rule.installmentsTotal < 1) {
        throw new ValidationError(
          'Installment expenses need the total number of installments',
        );
      }
      if (rule.installmentsPaid > rule.installmentsTotal) {
        throw new ValidationError(
          'Paid installments cannot exceed the total installments',
        );
      }
    }
  }

  private async validateReferences(
    userId: string,
    refs: { accountId?: string; categoryId?: string; debtId?: string },
    expenseId?: string,
  ) {
    if (refs.accountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: refs.accountId, userId },
        select: { id: true },
      });
      if (!account) throw new NotFoundError('Account not found');
    }
    if (refs.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: refs.categoryId, OR: [{ userId }, { userId: null }] },
        select: { id: true },
      });
      if (!category) throw new NotFoundError('Category not found');
    }
    if (refs.debtId) {
      const debt = await this.prisma.debt.findFirst({
        where: { id: refs.debtId, userId },
        include: { recurringExpense: { select: { id: true } } },
      });
      if (!debt) throw new NotFoundError('Debt not found');
      if (debt.recurringExpense && debt.recurringExpense.id !== expenseId) {
        throw new ConflictError(
          'This debt is already paid by another recurring expense',
        );
      }
    }
  }

  private rethrowUniqueViolation(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictError(
        'A recurring expense with this name already exists',
      );
    }
  }

  private normalizePattern(pattern?: string | null) {
    const value = pattern?.trim().toUpperCase();
    return value ? value : null;
  }

  private today(): Date {
    return toDateOnly(new Date());
  }

  mapExpense(row: RecurringExpenseRow): RecurringExpense {
    const amount = Number(row.amount);
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      trackingMode: row.trackingMode,
      frequency: row.frequency,
      interval: row.interval,
      startDate: row.startDate,
      endDate: row.endDate ?? undefined,
      amount,
      isVariableAmount: row.isVariableAmount,
      currency: row.currency,
      accountId: row.accountId ?? undefined,
      categoryId: row.categoryId ?? undefined,
      debtId: row.debtId ?? undefined,
      merchantPattern: row.merchantPattern ?? undefined,
      installmentsTotal: row.installmentsTotal ?? undefined,
      installmentsPaid: row.installmentsPaid,
      active: row.active,
      notes: row.notes ?? undefined,
      nextDueDate: row.nextDueDate ?? undefined,
      monthlyCost: monthlyEquivalent(amount, row.frequency, row.interval),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  mapOccurrence(row: RecurringOccurrenceRow): RecurringOccurrence {
    return {
      id: row.id,
      recurringExpenseId: row.recurringExpenseId,
      dueDate: row.dueDate,
      expectedAmount: Number(row.expectedAmount),
      status: row.status,
      transactionId: row.transactionId ?? undefined,
      paidAt: row.paidAt ?? undefined,
      matchedBy: row.matchedBy ?? undefined,
    };
  }
}
