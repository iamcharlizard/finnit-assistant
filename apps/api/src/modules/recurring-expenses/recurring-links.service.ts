import { Injectable } from '@nestjs/common';
import {
  CategorySource,
  OccurrenceMatchSource,
  OccurrenceStatus,
  TransactionType,
} from '@finnit/database';

import { PrismaService } from '../../services/prisma.service';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { RecurringExpensesService } from './recurring-expenses.service';
import {
  RecurringLinkOptions,
  RecurringLinkSlotStatus,
} from './dto/recurring-link.dto';
import {
  fitScore,
  monthOfDay,
  monthRange,
  monthsAround,
  namesMatch,
  rankExpenses,
  slotFor,
  type DayKey,
  type LinkSlot,
  type MonthKey,
} from './recurring-links';
import { rhythmDatesBetween } from './schedule.util';
import { normalizeMerchant } from './suggestions/detect';

const dayOf = (date: Date): DayKey => date.toISOString().slice(0, 10);
const dateOf = (day: DayKey) => new Date(`${day}T00:00:00Z`);

/** The bank's text of a movement (what a recurring expense's pattern is looked for in). */
const movementText = (movement: {
  merchantName: string | null;
  description: string | null;
}) => [movement.merchantName, movement.description].filter(Boolean).join(' ');

const EXPENSE_SELECT = {
  id: true,
  name: true,
  kind: true,
  amount: true,
  active: true,
  frequency: true,
  interval: true,
  startDate: true,
  endDate: true,
  categoryId: true,
  merchantPattern: true,
  isVariableAmount: true,
} as const;

type ExpenseRow = {
  id: string;
  name: string;
  kind: RecurringLinkOptions['expenses'][number]['kind'];
  amount: unknown;
  active: boolean;
  frequency: Parameters<typeof rhythmDatesBetween>[0]['frequency'];
  interval: number;
  startDate: Date;
  endDate: Date | null;
  categoryId: string | null;
  merchantPattern: string | null;
  isVariableAmount: boolean;
};

type OccurrenceRow = {
  id: string;
  recurringExpenseId: string;
  dueDate: Date;
  status: OccurrenceStatus;
  transactionId: string | null;
  expectedAmount: unknown;
};

/**
 * An expense that paid a recurring payment (a subscription, a membership…):
 * linking it marks that month's payment as paid (creating it when it wasn't
 * generated), gives the expense the recurring expense's category and teaches
 * the recurring expense its bank text, so the next syncs link by themselves.
 */
@Injectable()
export class RecurringLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recurring: RecurringExpensesService,
  ) {}

  /**
   * Every recurring expense the expense may have paid, with its payment in
   * each month around the expense's; the ones that fit first.
   */
  async options(
    userId: string,
    transactionId: string,
  ): Promise<RecurringLinkOptions> {
    const movement = await this.linkable(userId, transactionId);
    const day = dayOf(movement.txnDate);
    const month = monthOfDay(day);
    const months = monthsAround(month);
    const { expenses, occurrences } = await this.load(
      userId,
      movement.currency,
      months,
    );
    const text = movementText(movement);
    const amount = Number(movement.amount);

    const rows = expenses.map((expense) => {
      const slots = months.map((m) => this.slot(expense, occurrences, m, day));
      const own = slots.find((s) => s.month === month)!;
      const nameMatches = namesMatch(text, expense);
      return {
        expense,
        slots,
        id: expense.id,
        amount: Number(expense.amount),
        nameMatches,
        fit: fitScore(own, { day, amount }, expense.isVariableAmount),
      };
    });
    // Ended ones only when their text names the expense or they fit.
    const shown = rows.filter(
      (r) => r.expense.active || r.fit !== null || r.nameMatches,
    );
    const { ranked, proposed } = rankExpenses(shown, amount);

    return {
      month,
      months,
      proposedId: proposed,
      expenses: ranked.map((r) => ({
        id: r.expense.id,
        name: r.expense.name,
        kind: r.expense.kind,
        amount: r.amount,
        active: r.expense.active,
        categoryId: r.expense.categoryId,
        nameMatches: r.nameMatches,
        fits: r.fit !== null,
        slots: r.slots.map((s) => ({
          month: s.month,
          dueDate: dateOf(s.dueDay),
          status: s.status as RecurringLinkSlotStatus,
          expectedAmount: s.expectedAmount,
        })),
      })),
    };
  }

  /**
   * Links the expense to the recurring expense's payment of that month:
   * the payment is paid with it (one paid by hand only takes the movement;
   * one never generated is created on its usual day), the expense takes the
   * recurring expense's category and, when it has no merchant pattern yet
   * and its name isn't in the bank text, that text becomes its pattern.
   */
  async link(
    userId: string,
    transactionId: string,
    recurringExpenseId: string,
    month?: string | null,
  ): Promise<boolean> {
    const movement = await this.linkable(userId, transactionId);
    const day = dayOf(movement.txnDate);
    const chosen: MonthKey = month ?? monthOfDay(day);
    const expense = await this.prisma.recurringExpense.findFirst({
      where: { id: recurringExpenseId, userId },
      select: { ...EXPENSE_SELECT, debtId: true, currency: true },
    });
    if (!expense) throw new NotFoundError('Recurring expense not found');
    if (expense.debtId) {
      throw new ValidationError('Loan payments are linked from the loan');
    }
    if (expense.currency !== movement.currency) {
      throw new ValidationError('The expense is in another currency');
    }
    const { occurrences } = await this.load(
      userId,
      movement.currency,
      [chosen],
      expense.id,
    );
    const slot = this.slot(expense, occurrences, chosen, day);

    if (slot.status === 'linked') {
      throw new ConflictError("This month's payment already has its movement");
    }
    if (slot.status === 'paid_without_movement') {
      await this.prisma.recurringOccurrence.update({
        where: { id: slot.occurrenceId! },
        data: { transactionId, matchedBy: OccurrenceMatchSource.manual },
      });
    } else {
      const occurrenceId =
        slot.occurrenceId ??
        (
          await this.prisma.recurringOccurrence.create({
            data: {
              recurringExpenseId: expense.id,
              dueDate: dateOf(slot.dueDay),
              expectedAmount: slot.expectedAmount,
            },
            select: { id: true },
          })
        ).id;
      await this.recurring.markOccurrencePaid(
        occurrenceId,
        userId,
        transactionId,
      );
    }

    const pattern = normalizeMerchant(
      movement.merchantName || movement.description || '',
    );
    await this.prisma.$transaction([
      ...(expense.categoryId
        ? [
            this.prisma.transaction.update({
              where: { id: transactionId },
              data: {
                categoryId: expense.categoryId,
                categorySource: CategorySource.manual,
                suggestedCategoryId: null,
              },
            }),
          ]
        : []),
      ...(!expense.merchantPattern &&
      pattern &&
      !namesMatch(movementText(movement), expense)
        ? [
            this.prisma.recurringExpense.update({
              where: { id: expense.id },
              data: { merchantPattern: pattern },
            }),
          ]
        : []),
    ]);
    return true;
  }

  /** The user's recurring expenses (not loans) and their payments in those months. */
  private async load(
    userId: string,
    currency: string,
    months: MonthKey[],
    onlyId?: string,
  ): Promise<{ expenses: ExpenseRow[]; occurrences: OccurrenceRow[] }> {
    const from = dateOf(monthRange(months[0]).from);
    const to = dateOf(monthRange(months[months.length - 1]).to);
    const [expenses, occurrences] = await Promise.all([
      this.prisma.recurringExpense.findMany({
        where: {
          userId,
          debtId: null,
          currency,
          ...(onlyId && { id: onlyId }),
        },
        select: EXPENSE_SELECT,
        orderBy: { name: 'asc' },
      }),
      this.prisma.recurringOccurrence.findMany({
        where: {
          dueDate: { gte: from, lte: to },
          recurringExpense: {
            userId,
            debtId: null,
            ...(onlyId && { id: onlyId }),
          },
        },
        select: {
          id: true,
          recurringExpenseId: true,
          dueDate: true,
          status: true,
          transactionId: true,
          expectedAmount: true,
        },
      }),
    ]);
    return { expenses, occurrences };
  }

  private slot(
    expense: ExpenseRow,
    occurrences: ReadonlyArray<OccurrenceRow>,
    month: MonthKey,
    expenseDay: DayKey,
  ): LinkSlot {
    const { from, to } = monthRange(month);
    const rhythm = rhythmDatesBetween(
      {
        frequency: expense.frequency,
        interval: expense.interval,
        startDate: expense.startDate,
      },
      dateOf(from),
      dateOf(to),
    ).map(dayOf);
    return slotFor(
      month,
      occurrences
        .filter((o) => o.recurringExpenseId === expense.id)
        .map((o) => ({
          id: o.id,
          dueDay: dayOf(o.dueDate),
          status: o.status,
          hasMovement: o.transactionId !== null,
          expectedAmount: Number(o.expectedAmount),
        })),
      rhythm,
      expenseDay,
      Number(expense.amount),
    );
  }

  /** An expense of the user that pays nothing yet. */
  private async linkable(userId: string, transactionId: string) {
    const movement = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      include: {
        recurringPayment: { select: { id: true } },
        debtPayment: { select: { id: true } },
      },
    });
    if (!movement) throw new NotFoundError('Transaction not found');
    if (movement.type !== TransactionType.expense) {
      throw new ValidationError('Only expenses pay a recurring expense');
    }
    if (movement.recurringPayment || movement.debtPayment) {
      throw new ConflictError(
        'This transaction already pays another recurring expense',
      );
    }
    return movement;
  }
}
