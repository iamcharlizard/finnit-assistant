import { Injectable, Logger } from '@nestjs/common';
import {
  AiFeatureKey,
  LoanInterestMode,
  OccurrenceMatchSource,
  OccurrenceStatus,
  Prisma,
  RecurringFrequency,
  TransactionType,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  ConflictError,
  NotFoundError,
} from '../../common/exceptions/graphql-error.exception';
import { AiModelsService } from '../ai/ai-models.service';
import { JsonSchema } from '../ai/providers/ai-provider';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';
import { normalizeMerchant } from '../recurring-expenses/suggestions/detect';
import {
  addDays,
  dueDatesAfter,
  toDateOnly,
} from '../recurring-expenses/schedule.util';
import { Debt, LoanPaymentCandidate, LoanScheduleItem } from './dto/debt.dto';
import { DEBT_INCLUDE, DebtsService } from './debts.service';
import {
  balanceOf,
  financedCharges,
  isScheduledByCharges,
  totalOwedOf,
} from './debt-ledger';
import {
  amortizationSchedule,
  amountDue,
  chargeInstallments,
} from './loan-math';
import {
  MATCH_DATE_WINDOW_DAYS,
  matchLoanPayments,
  movementKey,
  PaymentMatch,
} from './payment-matching';

/** Open payments older than this are not reconciled any more. */
const CANDIDATE_LOOKBACK_DAYS = 45;
/** Future payments beyond this may already be paid ahead of time. */
const CANDIDATE_AHEAD_DAYS = 10;
/** Projected payments listed at most (a 50-year weekly loan). */
const MAX_PROJECTED = 2_600;
const AI_TIMEOUT_MS = 15_000;

const AI_PROMPT = `A Mexican user pays a loan; several bank movements could be one scheduled payment of it. Pick the movement that most likely pays the loan, judging by its text (lender names, references, "PAGO", "ABONO", SPEI to the lender). Answer "none" when none looks like it.`;

const AI_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: { ref: { type: 'string' } },
  required: ['ref'],
};

const cents = (amount: number) => Math.round(amount * 100) / 100;

/**
 * What a loan's payments look like over time and which bank movements pay
 * it: the full schedule (paid, open and projected payments) and the
 * movements proposed for its open payments.
 */
@Injectable()
export class LoanTrackingService {
  private readonly logger = new Logger(LoanTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly debts: DebtsService,
    private readonly recurring: RecurringExpensesService,
    private readonly aiModels: AiModelsService,
  ) {}

  /**
   * Every payment of the loan by date: the scheduled payments already
   * generated (paid, missed, open), then the projected ones until what is
   * owed is covered. Historical payments without a schedule are listed too.
   */
  async schedule(userId: string, debtId: string): Promise<LoanScheduleItem[]> {
    const debt = await this.prisma.debt.findFirst({
      where: { id: debtId, userId },
      include: {
        ...DEBT_INCLUDE,
        recurringExpense: {
          include: { occurrences: { orderBy: { dueDate: 'asc' } } },
        },
      },
    });
    if (!debt) throw new NotFoundError('Debt not found');

    // Historical payments of the loan's own schedule, by date. Those of a
    // charge's installments are listed apart (several may share a date).
    const historicalByDate = new Map(
      debt.payments
        .filter((p) => p.isHistorical && !p.chargeId)
        .map((p) => [p.date.getTime(), p]),
    );
    const chargePaidByDate = new Map<number, number>();
    for (const p of debt.payments) {
      if (!p.isHistorical || !p.chargeId) continue;
      const key = p.date.getTime();
      chargePaidByDate.set(
        key,
        cents((chargePaidByDate.get(key) ?? 0) + Number(p.amount)),
      );
    }
    const expense = debt.recurringExpense;
    // The date the schedule gave each row (a moved payment keeps it).
    const scheduleDate = new Map<Omit<LoanScheduleItem, 'balance'>, Date>();
    const items: Omit<LoanScheduleItem, 'balance'>[] = (
      expense?.occurrences ?? []
    ).map((o) => {
      const item = {
        dueDate: o.dueDate,
        amount: Number(o.expectedAmount),
        status: o.status,
        occurrenceId: o.id,
        transactionId: o.transactionId ?? undefined,
        isHistorical:
          o.status === OccurrenceStatus.paid &&
          !o.transactionId &&
          historicalByDate.has(o.dueDate.getTime()),
        projected: false,
        originalDueDate: o.originalDueDate ?? undefined,
      };
      scheduleDate.set(item, o.originalDueDate ?? o.dueDate);
      return item;
    });
    // Historical payments that are not one of the scheduled dates.
    const scheduled = new Set(
      items.map((i) => (scheduleDate.get(i) ?? i.dueDate).getTime()),
    );
    for (const payment of historicalByDate.values()) {
      if (scheduled.has(payment.date.getTime())) continue;
      items.push({
        dueDate: payment.date,
        amount: Number(payment.amount),
        status: OccurrenceStatus.paid,
        isHistorical: true,
        projected: false,
      });
    }
    // Rows of charge installments paid before registering them.
    const chargeHistory = new Set<Omit<LoanScheduleItem, 'balance'>>();
    for (const [time, amount] of chargePaidByDate) {
      const item = {
        dueDate: new Date(time),
        amount,
        status: OccurrenceStatus.paid,
        isHistorical: true,
        projected: false,
      };
      chargeHistory.add(item);
      items.push(item);
    }

    // Loans scheduled by their charges: what each payment covers.
    const byCharge =
      expense && isScheduledByCharges(debt)
        ? chargeInstallments(expense, financedCharges(debt))
        : null;
    const amounts = byCharge
      ? new Map([...byCharge].map(([time, due]) => [time, amountDue(due)]))
      : null;

    if (expense?.active) {
      // Still owed beyond the payments already scheduled.
      let left = cents(
        balanceOf(debt) -
          items
            .filter(
              (i) =>
                i.status === OccurrenceStatus.upcoming ||
                i.status === OccurrenceStatus.missed,
            )
            .reduce((sum, i) => sum + i.amount, 0),
      );
      const generated = expense.occurrences.map((o) =>
        (o.originalDueDate ?? o.dueDate).getTime(),
      );
      const last =
        generated.length > 0
          ? new Date(Math.max(...generated))
          : addDays(expense.startDate, -1);
      const dates = dueDatesAfter(expense, last, MAX_PROJECTED);
      for (const dueDate of dates) {
        if (left <= 0) break;
        // Charges scheduled this way end: nothing is projected past them.
        if (amounts && dueDate.getTime() > Math.max(0, ...amounts.keys())) {
          break;
        }
        const due = amounts
          ? (amounts.get(dueDate.getTime()) ?? 0)
          : Number(expense.amount);
        if (due <= 0) continue;
        const amount = Math.min(due, left);
        items.push({
          dueDate,
          amount: cents(amount),
          status: OccurrenceStatus.upcoming,
          isHistorical: false,
          projected: true,
        });
        left = cents(left - amount);
      }
    }

    if (byCharge) {
      for (const item of items) {
        // Each row names what it pays: a charge's installments paid before
        // registering it, the loan's first amount paid before registering
        // the loan, or the installments still due.
        const due = byCharge
          .get((scheduleDate.get(item) ?? item.dueDate).getTime())
          ?.filter((d) =>
            chargeHistory.has(item)
              ? d.paid
              : item.isHistorical
                ? d.chargeId === null
                : !d.paid,
          );
        if (due?.length) {
          item.installments = due.map((d) => ({
            number: d.number,
            of: d.of,
            amount: d.amount,
            description: d.description ?? undefined,
          }));
        }
      }
    }

    items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    return withBreakdown(debt, items);
  }

  /**
   * Bank movements that look like the loan's open payments (amount and date
   * fit; the lender's name or earlier payments from the same merchant make
   * it stronger). Ties between movements that only fit by amount are
   * settled by the AI when one is available. Nothing is linked until the
   * user confirms.
   */
  async paymentCandidates(
    userId: string,
    debtId: string,
  ): Promise<LoanPaymentCandidate[]> {
    const debt = await this.prisma.debt.findFirst({
      where: { id: debtId, userId },
      include: { recurringExpense: true },
    });
    if (!debt) throw new NotFoundError('Debt not found');
    const expense = debt.recurringExpense;
    if (!expense || !expense.active) return [];

    const today = toDateOnly(new Date());
    const open = await this.prisma.recurringOccurrence.findMany({
      where: {
        recurringExpenseId: expense.id,
        status: { in: [OccurrenceStatus.upcoming, OccurrenceStatus.missed] },
        dueDate: {
          gte: addDays(today, -CANDIDATE_LOOKBACK_DAYS),
          lte: addDays(today, CANDIDATE_AHEAD_DAYS),
        },
      },
    });
    if (open.length === 0) return [];

    const dueTimes = open.map((o) => o.dueDate.getTime());
    const [movements, paid] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId,
          type: TransactionType.expense,
          isPending: false,
          txnDate: {
            gte: addDays(
              new Date(Math.min(...dueTimes)),
              -MATCH_DATE_WINDOW_DAYS,
            ),
            lte: addDays(
              new Date(Math.max(...dueTimes)),
              MATCH_DATE_WINDOW_DAYS,
            ),
          },
          debtPayment: { is: null },
          recurringPayment: { is: null },
          transferFrom: { is: null },
          transferTo: { is: null },
        },
        include: { account: { select: { name: true } } },
      }),
      this.prisma.recurringOccurrence.findMany({
        where: {
          recurringExpenseId: expense.id,
          status: OccurrenceStatus.paid,
          transactionId: { not: null },
        },
        select: {
          transaction: { select: { merchantName: true, description: true } },
        },
        orderBy: { dueDate: 'desc' },
        take: 12,
      }),
    ]);

    const textOf = (t: {
      merchantName: string | null;
      description: string | null;
    }) => t.merchantName || t.description || '';
    const knownKeys = new Set(
      paid
        .map((p) => (p.transaction ? movementKey(textOf(p.transaction)) : ''))
        .filter(Boolean),
    );
    const movementById = new Map(movements.map((m) => [m.id, m]));
    const occurrenceById = new Map(open.map((o) => [o.id, o]));

    let matches = matchLoanPayments(
      open.map((o) => ({
        id: o.id,
        dueDate: o.dueDate,
        expectedAmount: Number(o.expectedAmount),
      })),
      movements.map((m) => ({
        id: m.id,
        date: m.txnDate,
        amount: Number(m.amount),
        text: textOf(m),
      })),
      {
        variable: expense.isVariableAmount,
        names: [expense.merchantPattern, debt.lenderName, debt.name],
        knownKeys,
      },
    );
    matches = await this.settleTies(
      matches,
      debt.lenderName ?? debt.name,
      (id) => {
        const m = movementById.get(id)!;
        return { text: textOf(m), amount: Number(m.amount), date: m.txnDate };
      },
    );

    return matches.map((match) => {
      const occurrence = occurrenceById.get(match.occurrenceId)!;
      const movement = movementById.get(match.transactionId)!;
      return {
        occurrenceId: occurrence.id,
        dueDate: occurrence.dueDate,
        expectedAmount: Number(occurrence.expectedAmount),
        transactionId: movement.id,
        date: movement.txnDate,
        amount: Number(movement.amount),
        description: textOf(movement),
        accountName: movement.account.name,
        reason: match.reason,
        score: match.score,
      };
    });
  }

  /**
   * Links a movement to an open payment of the loan (the debt payment comes
   * with it). The first time, the movement's merchant becomes the loan's
   * pattern, so later bank syncs reconcile its payments on their own.
   */
  async confirmPayment(
    userId: string,
    occurrenceId: string,
    transactionId: string,
  ): Promise<Debt> {
    const occurrence = await this.prisma.recurringOccurrence.findFirst({
      where: { id: occurrenceId, recurringExpense: { userId } },
      include: { recurringExpense: true },
    });
    const expense = occurrence?.recurringExpense;
    if (!occurrence || !expense?.debtId) {
      throw new NotFoundError('Scheduled loan payment not found');
    }
    if (occurrence.status === OccurrenceStatus.paid) {
      throw new ConflictError('This payment is already marked as paid');
    }
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      include: {
        debtPayment: { select: { id: true } },
        recurringPayment: { select: { id: true } },
      },
    });
    if (!transaction) throw new NotFoundError('Transaction not found');
    if (transaction.debtPayment || transaction.recurringPayment) {
      throw new ConflictError('This movement already pays something else');
    }

    const pattern = normalizeMerchant(
      transaction.merchantName || transaction.description || '',
    );
    await this.prisma.$transaction(async (tx) => {
      await this.recurring.markPaidInTransaction(
        tx,
        occurrence.id,
        transaction.id,
        OccurrenceMatchSource.manual,
      );
      if (!expense.merchantPattern && pattern) {
        await tx.recurringExpense.update({
          where: { id: expense.id },
          data: { merchantPattern: pattern },
        });
      }
    });
    return this.debts.findById(expense.debtId, userId);
  }

  /** Asks the AI to pick among tied movements; keeps the rules' pick otherwise. */
  private async settleTies(
    matches: PaymentMatch[],
    lender: string,
    movement: (id: string) => { text: string; amount: number; date: Date },
  ): Promise<PaymentMatch[]> {
    const settled: PaymentMatch[] = [];
    for (const match of matches) {
      if (!match.ambiguous) {
        settled.push(match);
        continue;
      }
      const ids = [match.transactionId, ...match.alternatives];
      const pick = await this.askAi(lender, ids.map(movement));
      if (pick === null) {
        settled.push(match);
      } else if (pick >= 0) {
        settled.push({ ...match, transactionId: ids[pick], reason: 'ai' });
      }
      // pick === -1: the AI says none of them pays the loan.
    }
    // A movement the AI picked may be another payment's pick too.
    const used = new Set<string>();
    return settled.filter(
      (m) => !used.has(m.transactionId) && used.add(m.transactionId),
    );
  }

  /** Index of the chosen movement, -1 for "none", null without an answer. */
  private async askAi(
    lender: string,
    candidates: { text: string; amount: number; date: Date }[],
  ): Promise<number | null> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timed out')), AI_TIMEOUT_MS);
      });
      const { data } = await Promise.race([
        this.aiModels.extractFromText(
          {
            prompt: AI_PROMPT,
            text: JSON.stringify({
              lender,
              movements: candidates.map((c, i) => ({
                ref: `m${i + 1}`,
                text: c.text,
                amount: c.amount,
                date: c.date.toISOString().slice(0, 10),
              })),
            }),
            schema: AI_SCHEMA,
            schemaName: 'pick_loan_payment',
            timeoutMs: AI_TIMEOUT_MS,
          },
          { feature: AiFeatureKey.recurring_classification },
        ),
        timeout,
      ]);
      const ref = (data as { ref?: unknown } | null)?.ref;
      if (ref === 'none') return -1;
      const match =
        typeof ref === 'string' ? /^m(\d+)$/.exec(ref.trim()) : null;
      const index = match ? Number(match[1]) - 1 : -1;
      return index >= 0 && index < candidates.length ? index : null;
    } catch (error) {
      this.logger.warn(
        `Loan payment tie not settled by AI: ${(error as Error).message}`,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * The amortization table: for a loan given by its rate (and nothing added
 * to it), each payment split into principal, interest, VAT and fee, with
 * the principal left. Any other loan gets what is still owed after each
 * payment.
 */
export function withBreakdown(
  debt: {
    principal: Prisma.Decimal | number;
    interestMode: LoanInterestMode | null;
    interestRateAnnual: Prisma.Decimal | number | null;
    installmentsTotal: number | null;
    paymentFrequency: RecurringFrequency | null;
    includesVat: boolean;
    periodicFee: Prisma.Decimal | number | null;
    charges: unknown[];
  } & Parameters<typeof totalOwedOf>[0],
  items: Omit<LoanScheduleItem, 'balance'>[],
): LoanScheduleItem[] {
  const fee = debt.periodicFee === null ? 0 : Number(debt.periodicFee);
  if (
    debt.interestMode === LoanInterestMode.rate &&
    debt.interestRateAnnual !== null &&
    debt.installmentsTotal &&
    debt.paymentFrequency &&
    debt.charges.length === 0
  ) {
    const rows = amortizationSchedule({
      principal: Number(debt.principal),
      annualRatePercent: Number(debt.interestRateAnnual),
      installments: debt.installmentsTotal,
      frequency: debt.paymentFrequency,
      includesVat: debt.includesVat,
    });
    return items.map((item, i) => {
      const row = rows[i];
      if (!row) return { ...item, balance: 0 };
      return {
        ...item,
        principal: row.principal,
        interest: row.interest,
        vat: row.vat,
        fee: fee > 0 ? fee : undefined,
        balance: row.balance,
      };
    });
  }
  let left = totalOwedOf(debt);
  return items.map((item) => {
    left = cents(Math.max(0, left - item.amount));
    return { ...item, balance: left };
  });
}
