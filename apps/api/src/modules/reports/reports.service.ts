import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import {
  MonthlyReport,
  CategoryExpense,
  CashFlowBaseline,
  CashFlowProjection,
  WhatIfInput,
  WhatIfResult,
} from './dto/report.dto';
import { loadCategoryI18n } from '../categories/category-names';
import { AppLocale, DEFAULT_LOCALE } from '../translation/locale';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthlyReport(
    userId: string,
    year: number,
    month: number,
    locale: AppLocale = DEFAULT_LOCALE,
  ): Promise<MonthlyReport> {
    // The whole month in UTC, like the dates imported from banks and
    // statements (midnight UTC of the day): up to, not including, the 1st of
    // the next month, so the last day counts entirely.
    // Pending transactions are left out until they are confirmed.
    const monthWhere = {
      userId,
      isPending: false,
      txnDate: {
        gte: new Date(Date.UTC(year, month - 1, 1)),
        lt: new Date(Date.UTC(year, month, 1)),
      },
    };

    // Get income and expenses for the month
    const [incomeData, expenseData] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...monthWhere, type: 'income' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...monthWhere, type: 'expense' },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = Number(incomeData._sum.amount || 0);
    const totalExpenses = Number(expenseData._sum.amount || 0);

    // Category breakdown, with the names in the request's locale (one query).
    const categoryExpenses = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { ...monthWhere, type: 'expense', categoryId: { not: null } },
      _sum: { amount: true },
    });
    const names = await loadCategoryI18n(
      this.prisma,
      categoryExpenses.flatMap((e) => (e.categoryId ? [e.categoryId] : [])),
      locale,
    );

    const categoryBreakdown: CategoryExpense[] = [];
    for (const expense of categoryExpenses) {
      if (!expense.categoryId) continue;
      const amount = Number(expense._sum.amount || 0);
      const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;

      categoryBreakdown.push({
        categoryId: expense.categoryId,
        categoryName: names.get(expense.categoryId)?.name || 'Unknown',
        amount,
        percentage: Math.round(percentage * 100) / 100,
      });
    }

    // Get user's currency (from first account)
    const userAccount = await this.prisma.account.findFirst({
      where: { userId },
    });

    return {
      year,
      month,
      currency: userAccount?.currency || 'MXN',
      totalIncome,
      totalExpenses,
      netIncome: totalIncome - totalExpenses,
      categoryBreakdown,
    };
  }

  /**
   * The current balance of the non-archived accounts and the average
   * monthly income and expenses over the last 6 months, divided by the
   * months the user actually has data for (a new user is not averaged
   * against empty months).
   */
  async getCashFlowBaseline(userId: string): Promise<CashFlowBaseline> {
    const accounts = await this.prisma.account.findMany({
      where: { userId, archived: false },
    });

    const currentBalance = accounts.reduce(
      (sum, account) => sum + Number(account.balanceCurrent),
      0,
    );

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const window = {
      userId,
      isPending: false,
      txnDate: { gte: sixMonthsAgo },
    };

    const [income, expenses, first] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...window, type: 'income' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...window, type: 'expense' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...window, type: { in: ['income', 'expense'] } },
        _min: { txnDate: true },
      }),
    ]);

    const months = monthsOfData(first._min.txnDate);
    return {
      currentBalance,
      monthlyIncome: Number(income._sum.amount || 0) / months,
      monthlyExpenses: Number(expenses._sum.amount || 0) / months,
      monthsOfData: months,
      currency: accounts[0]?.currency || 'MXN',
    };
  }

  async getCashFlowProjection(
    userId: string,
    monthsAhead = 6,
  ): Promise<CashFlowProjection[]> {
    const { currentBalance, monthlyIncome, monthlyExpenses } =
      await this.getCashFlowBaseline(userId);

    const projections: CashFlowProjection[] = [];
    let projectedBalance = currentBalance;

    for (let i = 1; i <= monthsAhead; i++) {
      const projectionDate = new Date();
      projectionDate.setMonth(projectionDate.getMonth() + i);

      projectedBalance = projectedBalance + monthlyIncome - monthlyExpenses;

      projections.push({
        date: projectionDate,
        projectedBalance,
        description: `Month ${i} projection`,
      });
    }

    return projections;
  }

  async runWhatIfScenario(
    userId: string,
    input: WhatIfInput,
  ): Promise<WhatIfResult> {
    // Get current total balance
    const accounts = await this.prisma.account.findMany({
      where: { userId, archived: false },
    });

    const startingBalance = accounts.reduce(
      (sum, account) => sum + Number(account.balanceCurrent),
      0,
    );

    const projections: CashFlowProjection[] = [];
    let currentBalance = startingBalance;
    const netMonthly = input.monthlyIncome - input.monthlyExpenses;

    for (let i = 1; i <= input.monthsToProject; i++) {
      currentBalance += netMonthly;

      const projectionDate = new Date(input.startDate);
      projectionDate.setMonth(projectionDate.getMonth() + i);

      projections.push({
        date: projectionDate,
        projectedBalance: currentBalance,
        description: `${input.scenarioName} - Month ${i}`,
      });
    }

    return {
      scenarioName: input.scenarioName,
      projections,
      finalBalance: currentBalance,
      totalSavings: currentBalance - startingBalance,
    };
  }
}

const AVERAGE_MONTH_DAYS = 30.44;

/** Months between the first transaction and now, from 1 to 6. */
export function monthsOfData(
  firstTxnDate: Date | null,
  now: Date = new Date(),
): number {
  if (!firstTxnDate) return 1;
  const days = (now.getTime() - firstTxnDate.getTime()) / 86_400_000;
  return Math.min(6, Math.max(1, Math.ceil(days / AVERAGE_MONTH_DAYS)));
}
