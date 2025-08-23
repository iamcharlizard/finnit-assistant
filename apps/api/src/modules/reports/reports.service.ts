import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import {
  MonthlyReport,
  CategoryExpense,
  CashFlowProjection,
  WhatIfInput,
  WhatIfResult,
} from './dto/report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthlyReport(userId: string, year: number, month: number): Promise<MonthlyReport> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get income and expenses for the month
    const [incomeData, expenseData] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          userId,
          type: 'income',
          txnDate: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          userId,
          type: 'expense',
          txnDate: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = Number(incomeData._sum.amount || 0);
    const totalExpenses = Number(expenseData._sum.amount || 0);

    // Get category breakdown
    const categoryExpenses = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: 'expense',
        txnDate: { gte: startDate, lte: endDate },
        categoryId: { not: null },
      },
      _sum: { amount: true },
    });

    const categoryBreakdown: CategoryExpense[] = [];
    for (const expense of categoryExpenses) {
      if (expense.categoryId) {
        const category = await this.prisma.category.findUnique({
          where: { id: expense.categoryId },
        });

        const amount = Number(expense._sum.amount || 0);
        const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;

        categoryBreakdown.push({
          categoryId: expense.categoryId,
          categoryName: category?.name || 'Unknown',
          amount,
          percentage: Math.round(percentage * 100) / 100,
        });
      }
    }

    // Get user's currency (from first account)
    const userAccount = await this.prisma.account.findFirst({
      where: { userId },
    });

    return {
      year,
      month,
      currency: userAccount?.currency || 'USD',
      totalIncome,
      totalExpenses,
      netIncome: totalIncome - totalExpenses,
      categoryBreakdown,
    };
  }

  async getCashFlowProjection(
    userId: string,
    monthsAhead = 6,
  ): Promise<CashFlowProjection[]> {
    // Get current total balance
    const accounts = await this.prisma.account.findMany({
      where: { userId, archived: false },
    });

    const currentBalance = accounts.reduce(
      (sum, account) => sum + Number(account.balanceCurrent),
      0,
    );

    // Get average monthly income and expenses
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [avgIncome, avgExpenses] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          userId,
          type: 'income',
          txnDate: { gte: sixMonthsAgo },
        },
        _avg: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          userId,
          type: 'expense',
          txnDate: { gte: sixMonthsAgo },
        },
        _avg: { amount: true },
      }),
    ]);

    const monthlyIncome = Number(avgIncome._avg.amount || 0) * 30; // Approximate
    const monthlyExpenses = Number(avgExpenses._avg.amount || 0) * 30;

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

  async runWhatIfScenario(userId: string, input: WhatIfInput): Promise<WhatIfResult> {
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