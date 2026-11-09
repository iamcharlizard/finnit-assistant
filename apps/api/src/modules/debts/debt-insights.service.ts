import { Injectable } from '@nestjs/common';
import {
  DebtKind,
  LoanType,
  OccurrenceStatus,
  RecurringExpenseKind,
  TransactionType,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import { countedInTotalsWhere } from '../categories/category-scope';
import {
  monthlyEquivalent,
  toDateOnly,
} from '../recurring-expenses/schedule.util';
import { DebtInsights, DebtInsightsArgs } from './dto/debt.dto';
import { DEBT_INCLUDE, monthlyPaymentOf } from './debts.service';
import { balanceOf, totalOwedOf } from './debt-ledger';
import {
  DebtCategory,
  DebtStream,
  lastMonths,
  paidByMonth,
  PaymentBucket,
  projectBalances,
  upcomingTotals,
} from './debt-insights';
import { LoanTrackingService } from './loan-tracking.service';

/** Months of income averaged for the debt load. */
const INCOME_MONTHS = 3;

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Numbers for the debts charts. Card MSI plans (recurring expenses of kind
 * installment) come apart in every figure, so the screen can show them with
 * or without them: they use a card's credit line, loans don't.
 */
@Injectable()
export class DebtInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracking: LoanTrackingService,
  ) {}

  async insights(
    userId: string,
    args: DebtInsightsArgs,
  ): Promise<DebtInsights> {
    const months = Math.min(Math.max(args.months ?? 12, 1), 36);
    const horizon = Math.min(Math.max(args.horizon ?? 24, 1), 120);
    const today = toDateOnly(new Date());
    const window = lastMonths(today, months);
    const since = new Date(`${window[0]}-01T00:00:00.000Z`);

    const loansOnly = args.loansOnly ?? false;
    const [debts, plans, msiPaid, income] = await Promise.all([
      this.prisma.debt.findMany({
        where: {
          userId,
          ...(loansOnly && {
            kind: DebtKind.loan,
            loanType: { not: LoanType.card_installments },
          }),
        },
        include: {
          ...DEBT_INCLUDE,
          recurringExpense: {
            select: { id: true, nextDueDate: true, installmentsPaid: true },
          },
          linkedAccount: { select: { name: true } },
        },
      }),
      // The loans page has no card MSI plans.
      loansOnly
        ? Promise.resolve([])
        : this.prisma.recurringExpense.findMany({
            where: {
              userId,
              kind: RecurringExpenseKind.installment,
              installmentsTotal: { not: null },
              // Card purchases in installments are debts now.
              debtId: null,
            },
            include: { account: { select: { name: true } } },
            orderBy: { nextDueDate: 'asc' },
          }),
      loansOnly
        ? Promise.resolve([])
        : this.prisma.recurringOccurrence.findMany({
            where: {
              status: OccurrenceStatus.paid,
              dueDate: { gte: since },
              recurringExpense: {
                userId,
                kind: RecurringExpenseKind.installment,
                debtId: null,
              },
            },
            select: {
              dueDate: true,
              expectedAmount: true,
              transaction: { select: { amount: true, txnDate: true } },
            },
          }),
      this.prisma.transaction.aggregate({
        where: {
          userId,
          type: TransactionType.income,
          isPending: false,
          AND: [countedInTotalsWhere()],
          txnDate: {
            gte: new Date(
              `${lastMonths(today, INCOME_MONTHS + 1)[0]}-01T00:00:00.000Z`,
            ),
            lt: new Date(`${monthKeyStart(today)}T00:00:00.000Z`),
          },
        },
        _sum: { amount: true },
      }),
    ]);

    const byType = new Map<
      DebtCategory,
      { remaining: number; totalOwed: number; paid: number; count: number }
    >();
    const add = (
      type: DebtCategory,
      values: { remaining: number; totalOwed: number; paid: number },
    ) => {
      const row = byType.get(type) ?? {
        remaining: 0,
        totalOwed: 0,
        paid: 0,
        count: 0,
      };
      row.remaining += values.remaining;
      row.totalOwed += values.totalOwed;
      row.paid += values.paid;
      row.count += 1;
      byType.set(type, row);
    };

    const streams: DebtStream[] = [];
    const payments: { date: Date; amount: number; bucket: PaymentBucket }[] =
      [];
    let monthlyPayments = 0;

    let msiMonthly = 0;
    const msi: DebtInsights['msi'] = [];
    for (const debt of debts) {
      const remaining = balanceOf(debt);
      const paid = debt.payments.reduce((s, p) => s + Number(p.amount), 0);
      const isMsi = debt.loanType === LoanType.card_installments;
      add(categoryOf(debt.kind, debt.loanType), {
        remaining,
        totalOwed: totalOwedOf(debt),
        paid,
      });
      for (const p of debt.payments) {
        payments.push({
          date: p.date,
          amount: Number(p.amount),
          bucket: isMsi ? 'msi' : p.isHistorical ? 'historical' : 'counted',
        });
      }
      if (isMsi) {
        msi.push({
          id: debt.id,
          debtId: debt.id,
          name: debt.name,
          accountName: debt.linkedAccount?.name ?? undefined,
          installmentAmount: Number(debt.installmentAmount ?? 0),
          installmentsTotal: debt.installmentsTotal ?? 0,
          installmentsPaid: debt.recurringExpense?.installmentsPaid ?? 0,
          remaining,
          nextDueDate:
            remaining > 0
              ? (debt.recurringExpense?.nextDueDate ?? undefined)
              : undefined,
        });
      }
      if (remaining <= 0) continue;
      const monthly = monthlyPaymentOf(debt);
      if (isMsi) msiMonthly += monthly;
      else monthlyPayments += monthly;
      const schedule = debt.recurringExpense
        ? (await this.tracking.schedule(userId, debt.id))
            .filter(
              (i) =>
                i.status === OccurrenceStatus.upcoming ||
                i.status === OccurrenceStatus.missed,
            )
            .map((i) => ({ dueDate: i.dueDate, amount: i.amount }))
        : null;
      streams.push({
        isMsi,
        remaining,
        schedule,
        monthly,
        monthlyRate: debt.interestRateAnnual
          ? Number(debt.interestRateAnnual) / 100 / 12
          : 0,
      });
    }

    for (const plan of plans) {
      const left = Math.max(0, plan.installmentsTotal! - plan.installmentsPaid);
      const amount = Number(plan.amount);
      const remaining = cents(amount * left);
      const monthly =
        plan.active && left > 0
          ? monthlyEquivalent(amount, plan.frequency, plan.interval)
          : 0;
      add('msi', {
        remaining,
        totalOwed: cents(amount * plan.installmentsTotal!),
        paid: cents(amount * plan.installmentsPaid),
      });
      if (remaining > 0) {
        msiMonthly += monthly;
        streams.push({
          isMsi: true,
          remaining,
          schedule: null,
          monthly,
          monthlyRate: 0,
        });
      }
      msi.push({
        id: plan.id,
        name: plan.name,
        accountName: plan.account?.name ?? undefined,
        installmentAmount: amount,
        installmentsTotal: plan.installmentsTotal!,
        installmentsPaid: plan.installmentsPaid,
        remaining,
        nextDueDate: plan.active ? (plan.nextDueDate ?? undefined) : undefined,
      });
    }
    for (const occurrence of msiPaid) {
      payments.push({
        date: occurrence.transaction?.txnDate ?? occurrence.dueDate,
        amount: Number(
          occurrence.transaction?.amount ?? occurrence.expectedAmount,
        ),
        bucket: 'msi',
      });
    }

    const debtStreams = streams.filter((s) => !s.isMsi);
    const msiStreams = streams.filter((s) => s.isMsi);
    return {
      byType: [...byType.entries()].map(([type, row]) => ({
        type,
        remaining: cents(row.remaining),
        totalOwed: cents(row.totalOwed),
        paid: cents(row.paid),
        count: row.count,
      })),
      paidByMonth: paidByMonth(window, payments),
      projection: projectBalances(today, horizon, streams),
      upcoming: upcomingTotals(today, debtStreams),
      upcomingMsi: upcomingTotals(today, msiStreams),
      monthlyPayments: cents(monthlyPayments),
      msiMonthlyPayments: cents(msiMonthly),
      averageMonthlyIncome: cents(
        Number(income._sum.amount ?? 0) / INCOME_MONTHS,
      ),
      msi,
    };
  }
}

function categoryOf(kind: DebtKind, loanType: string | null): DebtCategory {
  if (kind === DebtKind.card) return 'card';
  if (loanType === LoanType.card_installments) return 'msi';
  if (kind === DebtKind.loan && loanType) return loanType as DebtCategory;
  return 'other';
}

/** "YYYY-MM-01" of the date's month. */
function monthKeyStart(date: Date): string {
  return `${date.toISOString().slice(0, 7)}-01`;
}
