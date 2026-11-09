import { Injectable } from '@nestjs/common';
import {
  AccountType,
  LoanType,
  OccurrenceStatus,
  RecurringExpenseKind,
  StatementStatus,
  TransactionType,
} from '@finnit/database';
import { cycleInstallments, InstallmentPlan } from '../debts/card-installments';

import { PrismaService } from '../../services/prisma.service';
import { NotFoundError } from '../../common/exceptions/graphql-error.exception';
import {
  appliedEffect,
  effectOf,
} from '../../common/utils/balance-effect.util';
import { localToday } from '../../common/utils/local-date.util';
import {
  addDays,
  cycleFigures,
  cycleOf,
  cyclesBefore,
  interestEstimate,
  payingCycle,
  statementOn,
  type CardTerms,
  type CycleDates,
  type CycleMovement,
  type DayKey,
  type StatementFigures,
} from './credit-card-cycle';
import {
  CreditCardPeriod,
  CreditCardPeriodConnection,
  CreditCardPeriodStatus,
} from './dto/credit-card.dto';

/** The catalog key of the "Intereses" category. */
export const INTEREST_CATEGORY_KEY = 'categories.fees.interest';

const dayOf = (date: Date): DayKey => date.toISOString().slice(0, 10);
const dateOf = (day: DayKey): Date => new Date(`${day}T00:00:00Z`);

/** A credit card with terms, and everything its cycles are computed from. */
export interface CardContext {
  id: string;
  userId: string;
  name: string;
  currency: string;
  balance: number;
  terms: CardTerms;
  interestRateAnnual: number | null;
  connected: boolean;
  /** The bank difference adjustment: not a payment. */
  bankDifferenceId: string | null;
}

@Injectable()
export class CreditCardsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cycles newest first (the running one first), `first` at a time. */
  async periods(
    userId: string,
    accountId: string,
    first: number,
    after?: string,
  ): Promise<CreditCardPeriodConnection> {
    const card = await this.card(userId, accountId);
    if (!card) {
      return {
        edges: [],
        pageInfo: { hasNextPage: false, hasPreviousPage: Boolean(after) },
      };
    }
    const today = dayOf(localToday());
    const cycles = cyclesBefore(today, card.terms, first, after);
    const nodes = await this.figures(card, cycles, today);
    return {
      edges: nodes.map((node) => ({
        node,
        cursor: dayOf(node.statementDate),
      })),
      pageInfo: {
        // Cycles go back as far as the user wants; stop before the card existed.
        hasNextPage: true,
        hasPreviousPage: Boolean(after),
        startCursor: nodes[0] ? dayOf(nodes[0].statementDate) : undefined,
        endCursor: nodes.length
          ? dayOf(nodes[nodes.length - 1].statementDate)
          : undefined,
      },
    };
  }

  /**
   * One cycle: the one with that cut-off, or else the last closed one (its
   * payment is the one due now). Null when the card has no cut-off and
   * payment days yet.
   */
  async period(
    userId: string,
    accountId: string,
    statementDate?: string,
  ): Promise<CreditCardPeriod | null> {
    const card = await this.card(userId, accountId);
    if (!card) return null;
    const today = dayOf(localToday());
    const dates = statementDate
      ? cycleOf(statementOn(statementDate, card.terms), card.terms)
      : payingCycle(today, card.terms);
    const [node] = await this.figures(card, [dates], today);
    return node ?? null;
  }

  /**
   * The user's credit card, or null when it isn't one or has no terms yet
   * (the history asks for any account it is filtered by).
   */
  async card(userId: string, accountId: string): Promise<CardContext | null> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      include: {
        creditCardTerms: true,
        linkedAccounts: { select: { id: true }, take: 1 },
      },
    });
    if (!account) throw new NotFoundError('Account not found');
    if (account.type !== AccountType.credit) return null;
    return toCardContext(account);
  }

  /** Every credit card with terms (the daily reminders). */
  async cardsWithTerms(): Promise<CardContext[]> {
    const accounts = await this.prisma.account.findMany({
      where: {
        type: AccountType.credit,
        archived: false,
        creditCardTerms: { isNot: null },
      },
      include: {
        creditCardTerms: true,
        linkedAccounts: { select: { id: true }, take: 1 },
      },
    });
    return accounts
      .map(toCardContext)
      .filter((c): c is CardContext => c !== null);
  }

  /** The cycles' numbers, in the order given. */
  async figures(
    card: CardContext,
    cycles: ReadonlyArray<CycleDates>,
    today: DayKey,
  ): Promise<CreditCardPeriod[]> {
    if (cycles.length === 0) return [];
    const oldest = cycles.reduce(
      (min, c) => (c.periodStart < min ? c.periodStart : min),
      cycles[0].periodStart,
    );
    const newestCut = cycles.reduce(
      (max, c) => (c.statementDate > max ? c.statementDate : max),
      cycles[0].statementDate,
    );

    const [rows, statements, installments, interestCategory, plans] =
      await Promise.all([
        // Every movement since the oldest cycle began: the balance at each
        // cut-off is today's minus what came after it.
        this.prisma.transaction.findMany({
          where: {
            accountId: card.id,
            txnDate: { gte: dateOf(oldest) },
          },
          select: {
            id: true,
            type: true,
            amount: true,
            balanceEffect: true,
            isPending: true,
            txnDate: true,
            categoryId: true,
          },
        }),
        this.prisma.statementImport.findMany({
          where: {
            accountId: card.id,
            statementDate: {
              in: cycles.map((c) => dateOf(c.statementDate)),
            },
            status: StatementStatus.confirmed,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.recurringOccurrence.findMany({
          where: {
            transactionId: null,
            status: {
              in: [OccurrenceStatus.upcoming, OccurrenceStatus.missed],
            },
            dueDate: { gte: dateOf(oldest), lte: dateOf(newestCut) },
            recurringExpense: {
              accountId: card.id,
              kind: RecurringExpenseKind.installment,
            },
          },
          select: {
            dueDate: true,
            expectedAmount: true,
            recurringExpense: { select: { debtId: true } },
          },
        }),
        this.prisma.category.findFirst({
          where: { key: INTEREST_CATEGORY_KEY, userId: null },
          select: { id: true },
        }),
        // Purchases in installments on this card.
        this.prisma.debt.findMany({
          where: {
            linkedAccountId: card.id,
            loanType: LoanType.card_installments,
            startDate: { not: null },
            installmentsTotal: { not: null },
          },
          select: {
            id: true,
            name: true,
            startDate: true,
            installmentsTotal: true,
            installmentAmount: true,
            totalToRepay: true,
            principal: true,
            purchaseTransaction: { select: { txnDate: true } },
            recurringExpense: {
              select: {
                occurrences: {
                  where: { status: { not: OccurrenceStatus.skipped } },
                  orderBy: { dueDate: 'asc' },
                  select: { dueDate: true, expectedAmount: true },
                },
              },
            },
          },
        }),
      ]);
    const installmentPlans: InstallmentPlan[] = plans.map((plan) => ({
      debtId: plan.id,
      name: plan.name,
      purchaseDay: dayOf(plan.startDate!),
      count: plan.installmentsTotal!,
      totalToRepay: Number(plan.totalToRepay ?? plan.principal),
      installmentAmount: Number(plan.installmentAmount ?? 0),
      purchaseChargedOn: plan.purchaseTransaction
        ? dayOf(plan.purchaseTransaction.txnDate)
        : null,
      // Every installment is stored, with the days and amounts the user set.
      schedule: plan.recurringExpense?.occurrences.map((o) => ({
        day: dayOf(o.dueDate),
        amount: Number(o.expectedAmount),
      })),
    }));

    const movements: CycleMovement[] = rows.map((row) => ({
      day: dayOf(row.txnDate),
      effect: appliedEffect(effectOf(row), row.isPending),
      notPayment: row.id === card.bankDifferenceId,
    }));
    const statementByCut = new Map<DayKey, StatementFigures>();
    for (const s of statements) {
      if (!s.statementDate) continue;
      const cut = dayOf(s.statementDate);
      if (statementByCut.has(cut)) continue;
      statementByCut.set(cut, {
        statementDate: cut,
        periodStart: s.periodStart ? dayOf(s.periodStart) : null,
        paymentDueDate: s.paymentDueDate ? dayOf(s.paymentDueDate) : null,
        statementBalance:
          s.statementBalance !== null ? Number(s.statementBalance) : null,
        noInterestPayment:
          s.noInterestPayment !== null ? Number(s.noInterestPayment) : null,
        minimumPayment:
          s.minimumPayment !== null ? Number(s.minimumPayment) : null,
      });
    }

    // Interest is recorded in the cycle after the unpaid one.
    const interestDays = new Set(
      interestCategory
        ? rows
            .filter(
              (r) =>
                r.type === TransactionType.expense &&
                r.categoryId === interestCategory.id,
            )
            .map((r) => dayOf(r.txnDate))
        : [],
    );

    return cycles.map((dates) => {
      const ofCycle = cycleInstallments(installmentPlans, card.terms, dates);
      // Plans billed month by month whose installment has no movement yet;
      // a whole purchase in the balance already has it.
      const pending = installments
        .filter((o) => {
          const day = dayOf(o.dueDate);
          return (
            day >= dates.periodStart &&
            day <= dates.statementDate &&
            !ofCycle.inBalance.has(o.recurringExpense.debtId ?? '')
          );
        })
        .reduce((sum, o) => sum + Number(o.expectedAmount), 0);
      const figures = cycleFigures(dates, {
        today,
        currentBalance: card.balance,
        movements,
        pendingInstallments: pending,
        deferredInstallments: ofCycle.deferred,
        installmentsInCycle: ofCycle.inCycle,
        installmentBalance: ofCycle.balance,
        statement: statementByCut.get(dates.statementDate) ?? null,
      });
      const following = cycleOf(
        statementOn(addDays(figures.statementDate, 1), card.terms),
        card.terms,
      );
      const interestRecorded = [...interestDays].some(
        (day) => day > figures.paymentDueDate && day <= following.statementDate,
      );
      const askInterest = !card.connected && figures.status === 'unpaid';
      return {
        id: `${card.id}:${figures.statementDate}`,
        accountId: card.id,
        periodStart: dateOf(figures.periodStart),
        statementDate: dateOf(figures.statementDate),
        paymentDueDate: dateOf(figures.paymentDueDate),
        balanceAtStatement: figures.balanceAtStatement,
        pendingInstallments: figures.pendingInstallments,
        deferredInstallments: figures.deferredInstallments,
        installmentsInCycle: figures.installmentsInCycle,
        installmentBalance: figures.installmentBalance,
        cashBalance: figures.cashBalance,
        installments: ofCycle.rows,
        noInterestPayment: figures.noInterestPayment,
        minimumPayment: figures.minimumPayment,
        paid: figures.paid,
        remaining: figures.remaining,
        status: figures.status as CreditCardPeriodStatus,
        fromStatement: figures.fromStatement,
        connected: card.connected,
        interestEstimate: askInterest
          ? interestEstimate(
              figures.remaining,
              card.interestRateAnnual,
              figures.paymentDueDate,
              following.statementDate,
            )
          : null,
        interestRecorded,
        interestCategoryId: interestCategory?.id ?? null,
        interestRateAnnual: card.interestRateAnnual,
        currency: card.currency,
      };
    });
  }
}

function toCardContext(account: {
  id: string;
  userId: string;
  name: string;
  currency: string;
  balanceCurrent: unknown;
  bankDifferenceTransactionId: string | null;
  creditCardTerms: {
    statementDay: number;
    paymentDueDay: number;
    interestRateAnnual: unknown;
  } | null;
  linkedAccounts: { id: string }[];
}): CardContext | null {
  const terms = account.creditCardTerms;
  if (!terms) return null;
  return {
    id: account.id,
    userId: account.userId,
    name: account.name,
    currency: account.currency,
    balance: Number(account.balanceCurrent),
    terms: {
      statementDay: terms.statementDay,
      paymentDueDay: terms.paymentDueDay,
    },
    interestRateAnnual:
      terms.interestRateAnnual !== null &&
      terms.interestRateAnnual !== undefined
        ? Number(terms.interestRateAnnual)
        : null,
    connected: account.linkedAccounts.length > 0,
    bankDifferenceId: account.bankDifferenceTransactionId,
  };
}
