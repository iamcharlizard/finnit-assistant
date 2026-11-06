import { Injectable } from '@nestjs/common';
import {
  OccurrenceMatchSource,
  OccurrenceStatus,
  Prisma,
  TransactionType,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { addDays, toLocalDateOnly } from '../../common/utils/local-date.util';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';
import { toDateOnly } from '../recurring-expenses/schedule.util';
import { Debt } from './dto/debt.dto';
import { LoanExpenseCandidate, LoanLinkOptions } from './dto/loan-link.dto';
import { syncDebtStatus } from './debt-ledger';
import { DebtsService } from './debts.service';
import { LoanTrackingService } from './loan-tracking.service';
import {
  CANDIDATE_WINDOW_DAYS,
  FIXED_AMOUNT_TOLERANCE,
  rankExpenseCandidates,
  rankLoansForMovement,
  suggestedLoan,
  VARIABLE_AMOUNT_TOLERANCE,
  type LinkTargetState,
} from './loan-links';
import { movementKey } from './payment-matching';

/** Payments of a loan listed for a movement, the closest ones. */
const MAX_TARGETS = 24;
const MAX_CANDIDATES = 20;
/** How far back a text search looks. */
const SEARCH_DAYS = 365;
const MAX_SEARCH = 40;

const textOf = (t: {
  merchantName: string | null;
  description: string | null;
}) => t.merchantName || t.description || '';

type OccurrenceWithExpense = Prisma.RecurringOccurrenceGetPayload<{
  include: { recurringExpense: true };
}>;

/**
 * Links an expense movement to a payment of a loan, and undoes it. From the
 * movement: which loans and payments it can pay (the one due that same day
 * is suggested). From the loan: which movements look like a payment. A
 * payment already paid without a movement (paid before the loan was
 * registered) can take one; a payment with a movement must be unlinked
 * before linking another.
 */
@Injectable()
export class LoanLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly debts: DebtsService,
    private readonly recurring: RecurringExpensesService,
    private readonly tracking: LoanTrackingService,
  ) {}

  async linkOptions(
    userId: string,
    transactionId: string,
  ): Promise<LoanLinkOptions> {
    const movement = await this.linkableMovement(userId, transactionId);
    const today = toDateOnly(new Date());
    const debts = await this.prisma.debt.findMany({
      where: { userId, recurringExpense: { isNot: null } },
      include: {
        recurringExpense: {
          include: {
            occurrences: {
              where: {
                OR: [
                  {
                    status: {
                      in: [OccurrenceStatus.upcoming, OccurrenceStatus.missed],
                    },
                  },
                  { status: OccurrenceStatus.paid, transactionId: null },
                ],
              },
              orderBy: { dueDate: 'asc' },
            },
          },
        },
      },
    });
    const knownKeys = await this.knownKeys(debts.map((d) => d.id));
    const day = toLocalDateOnly(movement.txnDate);

    const ranked = rankLoansForMovement(
      { day, amount: Number(movement.amount), text: textOf(movement) },
      debts.map((debt) => {
        const expense = debt.recurringExpense!;
        return {
          debtId: debt.id,
          names: [expense.merchantPattern, debt.lenderName, debt.name],
          knownKeys: knownKeys.get(debt.id) ?? new Set<string>(),
          variable: expense.isVariableAmount,
          targets: expense.occurrences.map((o) => ({
            occurrenceId: o.id,
            dueDate: o.dueDate,
            amount: Number(o.expectedAmount),
            state: targetState(o, today),
          })),
        };
      }),
    );
    const byId = new Map(debts.map((d) => [d.id, d]));
    const suggested = suggestedLoan(ranked);
    return {
      suggestedDebtId: suggested?.debtId,
      loans: ranked.map((loan) => {
        const debt = byId.get(loan.debtId)!;
        return {
          debtId: debt.id,
          name: debt.name,
          lenderName: debt.lenderName ?? undefined,
          suggestedOccurrenceId: loan.suggestedOccurrenceId ?? undefined,
          payments: loan.targets
            .slice(0, MAX_TARGETS)
            .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
            .map((t) => ({
              occurrenceId: t.occurrenceId,
              dueDate: t.dueDate,
              amount: t.amount,
              state: t.state,
            })),
        };
      }),
    };
  }

  async expenseCandidates(
    userId: string,
    occurrenceId: string,
    search?: string,
  ): Promise<LoanExpenseCandidate[]> {
    const occurrence = await this.linkableOccurrence(userId, occurrenceId);
    const expense = occurrence.recurringExpense;
    const debt = await this.prisma.debt.findUniqueOrThrow({
      where: { id: expense.debtId! },
      select: { id: true, name: true, lenderName: true },
    });
    const expected = Number(occurrence.expectedAmount);
    const tolerance = expense.isVariableAmount
      ? VARIABLE_AMOUNT_TOLERANCE
      : FIXED_AMOUNT_TOLERANCE;
    const text = search?.trim();
    const where: Prisma.TransactionWhereInput = {
      userId,
      type: TransactionType.expense,
      isPending: false,
      debtPayment: { is: null },
      recurringPayment: { is: null },
      ...(text
        ? {
            txnDate: { gte: addDays(toDateOnly(new Date()), -SEARCH_DAYS) },
            OR: [
              { merchantName: { contains: text, mode: 'insensitive' } },
              { description: { contains: text, mode: 'insensitive' } },
            ],
          }
        : {
            txnDate: {
              gte: addDays(occurrence.dueDate, -CANDIDATE_WINDOW_DAYS),
              lte: addDays(occurrence.dueDate, CANDIDATE_WINDOW_DAYS + 1),
            },
            amount: {
              gte: cents(expected * (1 - tolerance)),
              lte: cents(expected * (1 + tolerance)),
            },
          }),
    };
    const [movements, keys] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: { account: { select: { name: true } } },
        orderBy: { txnDate: 'desc' },
        take: text ? MAX_SEARCH * 2 : 200,
      }),
      this.knownKeys([debt.id]),
    ]);
    const byId = new Map(movements.map((m) => [m.id, m]));
    const ranked = rankExpenseCandidates(
      movements.map((m) => ({
        id: m.id,
        date: toLocalDateOnly(m.txnDate),
        amount: Number(m.amount),
        text: textOf(m),
      })),
      {
        dueDate: occurrence.dueDate,
        expected,
        variable: expense.isVariableAmount,
        names: [expense.merchantPattern, debt.lenderName, debt.name],
        knownKeys: keys.get(debt.id) ?? new Set<string>(),
        searching: Boolean(text),
      },
    );
    return ranked.slice(0, text ? MAX_SEARCH : MAX_CANDIDATES).map((r) => {
      const m = byId.get(r.id)!;
      return {
        transactionId: m.id,
        date: m.txnDate,
        amount: Number(m.amount),
        description: textOf(m),
        accountName: m.account.name,
        nameMatch: r.nameMatch,
        exactAmount: r.exactAmount,
        score: r.score,
      };
    });
  }

  /**
   * Links the movement to the payment. An open payment becomes paid by it
   * (as confirming a proposed movement); one paid without a movement keeps
   * being paid, now by it, and counts with the movement's amount.
   */
  async link(
    userId: string,
    occurrenceId: string,
    transactionId: string,
  ): Promise<Debt> {
    const occurrence = await this.linkableOccurrence(userId, occurrenceId);
    const movement = await this.linkableMovement(userId, transactionId);
    const expense = occurrence.recurringExpense;
    const debtId = expense.debtId!;

    if (occurrence.status !== OccurrenceStatus.paid) {
      return this.tracking.confirmPayment(userId, occurrenceId, transactionId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.recurringOccurrence.update({
        where: { id: occurrence.id },
        data: {
          transactionId: movement.id,
          matchedBy: OccurrenceMatchSource.manual,
        },
      });
      const historical = await tx.debtPayment.findFirst({
        where: {
          debtId,
          transactionId: null,
          chargeId: null,
          date: {
            in: [occurrence.dueDate, occurrence.originalDueDate].filter(
              (d): d is Date => d !== null,
            ),
          },
        },
        orderBy: { date: 'asc' },
      });
      const data = {
        transactionId: movement.id,
        isHistorical: false,
        amount: movement.amount,
        date: movement.txnDate,
      };
      if (historical) {
        await tx.debtPayment.update({ where: { id: historical.id }, data });
      } else {
        await tx.debtPayment.create({ data: { debtId, ...data } });
      }
      await this.giveLoanCategory(tx, movement, expense.categoryId);
      await syncDebtStatus(tx, debtId);
    });
    return this.debts.findById(debtId, userId);
  }

  /**
   * Takes the movement off the payment; the movement stays as a plain
   * expense. The payment goes back to open, or stays paid without a
   * movement (`keepPaid`), counting its scheduled amount.
   */
  async unlink(
    userId: string,
    occurrenceId: string,
    keepPaid: boolean,
  ): Promise<Debt> {
    const occurrence = await this.prisma.recurringOccurrence.findFirst({
      where: {
        id: occurrenceId,
        recurringExpense: { userId, debtId: { not: null } },
      },
      include: { recurringExpense: true },
    });
    if (!occurrence)
      throw new NotFoundError('Scheduled loan payment not found');
    const debtId = occurrence.recurringExpense.debtId!;
    const transactionId = occurrence.transactionId;
    if (!transactionId) {
      throw new ValidationError('This payment has no movement linked');
    }

    if (!keepPaid) {
      await this.recurring.reopenOccurrence(occurrenceId, userId);
      return this.debts.findById(debtId, userId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.debtPayment.updateMany({
        where: { debtId, transactionId },
        data: {
          transactionId: null,
          isHistorical: true,
          amount: occurrence.expectedAmount,
          date: occurrence.dueDate,
        },
      });
      await tx.recurringOccurrence.update({
        where: { id: occurrence.id },
        data: { transactionId: null, matchedBy: null },
      });
      await syncDebtStatus(tx, debtId);
    });
    return this.debts.findById(debtId, userId);
  }

  /** A payment of one of the user's loans that can take a movement. */
  private async linkableOccurrence(
    userId: string,
    occurrenceId: string,
  ): Promise<OccurrenceWithExpense> {
    const occurrence = await this.prisma.recurringOccurrence.findFirst({
      where: {
        id: occurrenceId,
        recurringExpense: { userId, debtId: { not: null } },
      },
      include: { recurringExpense: true },
    });
    if (!occurrence)
      throw new NotFoundError('Scheduled loan payment not found');
    if (occurrence.transactionId) {
      throw new ConflictError(
        'This payment is already linked to a movement; unlink it first',
      );
    }
    if (occurrence.status === OccurrenceStatus.skipped) {
      throw new ValidationError('Reopen the skipped payment before linking it');
    }
    return occurrence;
  }

  /** One of the user's expenses that pays nothing yet. */
  private async linkableMovement(userId: string, transactionId: string) {
    const movement = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      include: {
        debtPayment: { select: { id: true } },
        recurringPayment: { select: { id: true } },
        category: { select: { key: true } },
      },
    });
    if (!movement) throw new NotFoundError('Transaction not found');
    if (movement.type !== TransactionType.expense) {
      throw new ValidationError('Only an expense can pay a loan');
    }
    if (movement.debtPayment || movement.recurringPayment) {
      throw new ConflictError('This movement already pays something else');
    }
    return movement;
  }

  /** A movement without a category takes the loan's (Loan Payments). */
  private async giveLoanCategory(
    tx: Prisma.TransactionClient,
    movement: { id: string; category: { key: string | null } | null },
    categoryId: string | null,
  ) {
    if (
      categoryId &&
      (!movement.category ||
        movement.category.key === 'categories.uncategorized')
    ) {
      await tx.transaction.update({
        where: { id: movement.id },
        data: { categoryId },
      });
    }
  }

  /** Merchant keys of the movements that already paid each loan. */
  private async knownKeys(
    debtIds: string[],
  ): Promise<Map<string, Set<string>>> {
    const keys = new Map<string, Set<string>>();
    if (debtIds.length === 0) return keys;
    const paid = await this.prisma.debtPayment.findMany({
      where: { debtId: { in: debtIds }, transactionId: { not: null } },
      select: {
        debtId: true,
        transaction: { select: { merchantName: true, description: true } },
      },
      orderBy: { date: 'desc' },
      take: 12 * debtIds.length,
    });
    for (const p of paid) {
      if (!p.transaction) continue;
      const key = movementKey(textOf(p.transaction));
      if (!key) continue;
      const set = keys.get(p.debtId) ?? new Set<string>();
      set.add(key);
      keys.set(p.debtId, set);
    }
    return keys;
  }
}

const cents = (amount: number) => Math.round(amount * 100) / 100;

function targetState(
  occurrence: { status: OccurrenceStatus; dueDate: Date },
  today: Date,
): LinkTargetState {
  if (occurrence.status === OccurrenceStatus.paid) {
    return 'paid_without_movement';
  }
  return occurrence.status === OccurrenceStatus.missed ||
    occurrence.dueDate < today
    ? 'overdue'
    : 'open';
}
