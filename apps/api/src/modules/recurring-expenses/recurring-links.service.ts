import { Injectable } from '@nestjs/common';
import {
  CategorySource,
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

const dayOf = (date: Date) => date.toISOString().slice(0, 10);
const shiftDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 86_400_000);

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

  /** The scheduled payments the expense may have paid, closest first. */
  async options(
    userId: string,
    transactionId: string,
  ): Promise<RecurringLinkOption[]> {
    const movement = await this.linkable(userId, transactionId);
    const occurrences = await this.prisma.recurringOccurrence.findMany({
      where: {
        transactionId: null,
        status: { in: [OccurrenceStatus.upcoming, OccurrenceStatus.missed] },
        dueDate: {
          gte: shiftDays(movement.txnDate, -LINK_WINDOW_DAYS),
          lte: shiftDays(movement.txnDate, LINK_WINDOW_DAYS),
        },
        recurringExpense: {
          userId,
          active: true,
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
          },
        },
      },
      take: 200,
    });
    const text = [
      movement.merchantName,
      movement.description,
      movement.aliasName,
    ]
      .filter(Boolean)
      .join(' ');
    const { ranked, proposed } = rankLinkCandidates(
      occurrences.map((o) => ({
        occurrence: o,
        occurrenceId: o.id,
        dueDay: dayOf(o.dueDate),
        expectedAmount: Number(o.expectedAmount),
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
   * it, and the expense takes the recurring expense's category.
   */
  async link(
    userId: string,
    transactionId: string,
    occurrenceId: string,
  ): Promise<boolean> {
    await this.linkable(userId, transactionId);
    const occurrence = await this.prisma.recurringOccurrence.findFirst({
      where: { id: occurrenceId, recurringExpense: { userId } },
      include: {
        recurringExpense: { select: { debtId: true, categoryId: true } },
      },
    });
    if (!occurrence) throw new NotFoundError('Recurring payment not found');
    if (occurrence.recurringExpense.debtId) {
      throw new ValidationError('Loan payments are linked from the loan');
    }
    await this.recurring.markOccurrencePaid(
      occurrenceId,
      userId,
      transactionId,
    );
    const categoryId = occurrence.recurringExpense.categoryId;
    if (categoryId) {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          categoryId,
          categorySource: CategorySource.manual,
          suggestedCategoryId: null,
        },
      });
    }
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
