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
import { RecurringLinkOption } from './dto/recurring-link.dto';
import {
  LINK_WINDOW_DAYS,
  namesMatch,
  rankLinkCandidates,
} from './recurring-links';
import { normalizeMerchant } from './suggestions/detect';

const dayOf = (date: Date) => date.toISOString().slice(0, 10);
const shiftDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 86_400_000);

/** The bank's text of a movement (what a recurring expense's pattern is looked for in). */
const movementText = (movement: {
  merchantName: string | null;
  description: string | null;
}) => [movement.merchantName, movement.description].filter(Boolean).join(' ');

/**
 * An expense that paid a recurring payment (a subscription, a membership…):
 * linking it marks that month's payment as paid and gives the expense the
 * recurring expense's category.
 */
@Injectable()
export class RecurringLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recurring: RecurringExpensesService,
  ) {}

  /**
   * The scheduled payments the expense may have paid: due near its day with
   * a similar amount (the bank sync's rules), pending, missed or marked paid
   * without a movement.
   */
  async options(
    userId: string,
    transactionId: string,
  ): Promise<RecurringLinkOption[]> {
    const movement = await this.linkable(userId, transactionId);
    const occurrences = await this.prisma.recurringOccurrence.findMany({
      where: {
        transactionId: null,
        status: {
          in: [
            OccurrenceStatus.upcoming,
            OccurrenceStatus.missed,
            OccurrenceStatus.paid,
          ],
        },
        dueDate: {
          gte: shiftDays(movement.txnDate, -LINK_WINDOW_DAYS),
          lte: shiftDays(movement.txnDate, LINK_WINDOW_DAYS),
        },
        recurringExpense: {
          userId,
          debtId: null,
          currency: movement.currency,
        },
      },
      include: {
        recurringExpense: {
          select: {
            id: true,
            name: true,
            kind: true,
            accountId: true,
            merchantPattern: true,
            categoryId: true,
            isVariableAmount: true,
          },
        },
      },
      take: 200,
    });
    const text = movementText(movement);
    const { ranked, proposed } = rankLinkCandidates(
      occurrences.map((o) => ({
        occurrence: o,
        occurrenceId: o.id,
        dueDay: dayOf(o.dueDate),
        expectedAmount: Number(o.expectedAmount),
        isVariableAmount: o.recurringExpense.isVariableAmount,
        sameAccount: o.recurringExpense.accountId === movement.accountId,
        nameMatches: namesMatch(text, o.recurringExpense),
      })),
      { day: dayOf(movement.txnDate), amount: Number(movement.amount) },
    );
    return ranked.slice(0, 30).map(({ occurrence: o }) => ({
      occurrenceId: o.id,
      recurringExpenseId: o.recurringExpense.id,
      name: o.recurringExpense.name,
      kind: o.recurringExpense.kind,
      dueDate: o.dueDate,
      expectedAmount: Number(o.expectedAmount),
      status: o.status,
      categoryId: o.recurringExpense.categoryId,
      proposed: o.id === proposed,
    }));
  }

  /**
   * Links the expense to that scheduled payment: the payment is paid with
   * it (one marked paid without a movement takes it), the expense takes the
   * recurring expense's category and, when the expense has no merchant
   * pattern yet, its bank text becomes it, so the next syncs link by
   * themselves.
   */
  async link(
    userId: string,
    transactionId: string,
    occurrenceId: string,
  ): Promise<boolean> {
    const movement = await this.linkable(userId, transactionId);
    const occurrence = await this.prisma.recurringOccurrence.findFirst({
      where: { id: occurrenceId, recurringExpense: { userId } },
      include: {
        recurringExpense: {
          select: {
            id: true,
            name: true,
            debtId: true,
            categoryId: true,
            merchantPattern: true,
          },
        },
      },
    });
    if (!occurrence) throw new NotFoundError('Recurring payment not found');
    const expense = occurrence.recurringExpense;
    if (expense.debtId) {
      throw new ValidationError('Loan payments are linked from the loan');
    }
    if (occurrence.transactionId) {
      throw new ConflictError('This payment already has its movement');
    }

    if (occurrence.status === OccurrenceStatus.paid) {
      // Paid by hand before: it only gets its movement.
      await this.prisma.recurringOccurrence.update({
        where: { id: occurrence.id },
        data: { transactionId, matchedBy: OccurrenceMatchSource.manual },
      });
    } else {
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
