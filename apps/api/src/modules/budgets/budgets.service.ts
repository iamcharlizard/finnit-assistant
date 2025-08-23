import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { 
  Budget, 
  CreateBudgetInput, 
  UpdateBudgetInput,
  BudgetUsage, 
  BudgetSummary,
  BudgetAlert 
} from './dto/budget.dto';
import { NotFoundError, ConflictError, BudgetExceededError } from '../../common/exceptions/graphql-error.exception';

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateBudgetInput): Promise<Budget> {
    // Check if budget already exists for this month/year
    const existing = await this.prisma.budget.findFirst({
      where: { userId, year: input.year, month: input.month },
    });

    if (existing) {
      throw new ConflictError('Budget already exists for this month');
    }

    const budget = await this.prisma.budget.create({
      data: {
        userId,
        year: input.year,
        month: input.month,
        currency: input.currency,
        amountTotal: input.amountTotal,
        categories: {
          create: input.categories.map((cat) => ({
            categoryId: cat.categoryId,
            capAmount: cat.capAmount,
          })),
        },
      },
      include: { categories: true },
    });

    return this.mapBudget(budget);
  }

  async findMany(userId: string): Promise<Budget[]> {
    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      include: { categories: true },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return budgets.map(this.mapBudget);
  }

  async findById(id: string, userId: string): Promise<Budget> {
    const budget = await this.prisma.budget.findFirst({
      where: { id, userId },
      include: { categories: true },
    });

    if (!budget) {
      throw new NotFoundError('Budget not found');
    }

    return this.mapBudget(budget);
  }

  async getBudgetUsage(id: string, userId: string): Promise<BudgetUsage[]> {
    const budget = await this.prisma.budget.findFirst({
      where: { id, userId },
      include: { categories: true },
    });

    if (!budget) {
      throw new NotFoundError('Budget not found');
    }

    // Get spending data for the budget period
    const startDate = new Date(budget.year, budget.month - 1, 1);
    const endDate = new Date(budget.year, budget.month, 0);

    const usage: BudgetUsage[] = [];

    for (const category of budget.categories) {
      const spent = await this.prisma.transaction.aggregate({
        where: {
          userId,
          categoryId: category.categoryId,
          type: 'expense',
          txnDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: { amount: true },
      });

      const spentAmount = Number(spent._sum.amount || 0);
      const budgeted = Number(category.capAmount);
      const remaining = budgeted - spentAmount;
      const percentage = budgeted > 0 ? (spentAmount / budgeted) * 100 : 0;

      usage.push({
        categoryId: category.categoryId,
        budgeted,
        spent: spentAmount,
        remaining,
        percentage: Math.round(percentage * 100) / 100,
      });
    }

    return usage;
  }

  async update(id: string, userId: string, input: UpdateBudgetInput): Promise<Budget> {
    const existingBudget = await this.prisma.budget.findFirst({
      where: { id, userId },
    });

    if (!existingBudget) {
      throw new NotFoundError('Budget not found');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Update budget
      const updatedBudget = await tx.budget.update({
        where: { id },
        data: {
          amountTotal: input.amountTotal,
        },
      });

      // Update category budgets if provided
      if (input.categories && input.categories.length > 0) {
        // Delete existing category budgets
        await tx.bUDGET_CATEGORY.deleteMany({
          where: { budgetId: id },
        });

        // Create new category budgets
        await tx.bUDGET_CATEGORY.createMany({
          data: input.categories.map((cat) => ({
            budgetId: id,
            categoryId: cat.categoryId,
            capAmount: cat.capAmount,
          })),
        });
      }

      const finalBudget = await tx.budget.findUnique({
        where: { id },
        include: { categories: true },
      });

      return this.mapBudget(finalBudget!);
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const budget = await this.prisma.budget.findFirst({
      where: { id, userId },
    });

    if (!budget) {
      throw new NotFoundError('Budget not found');
    }

    await this.prisma.budget.delete({
      where: { id },
    });

    return true;
  }

  async getCurrentBudget(userId: string): Promise<Budget | null> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const budget = await this.prisma.budget.findFirst({
      where: { 
        userId, 
        year: currentYear, 
        month: currentMonth 
      },
      include: { categories: true },
    });

    return budget ? this.mapBudget(budget) : null;
  }

  async getBudgetSummary(userId: string, year: number, month: number): Promise<BudgetSummary> {
    const budget = await this.prisma.budget.findFirst({
      where: { userId, year, month },
      include: { categories: true },
    });

    if (!budget) {
      throw new NotFoundError('Budget not found');
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Calculate total budgeted amount
    const totalBudgeted = budget.categories.reduce((sum, cat) => sum + Number(cat.capAmount), 0);

    // Calculate total spent
    const totalSpentResult = await this.prisma.transaction.aggregate({
      where: {
        userId,
        type: 'expense',
        txnDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: { amount: true },
    });

    const totalSpent = Number(totalSpentResult._sum.amount || 0);
    const totalRemaining = totalBudgeted - totalSpent;
    const overallPercentage = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

    // Get category-wise usage
    const categoryUsage = await this.getBudgetUsage(budget.id, userId);
    
    // Find categories over budget
    const categoriesOverBudget = categoryUsage.filter(usage => usage.percentage > 100);
    
    // Find categories near budget (80-100%)
    const categoriesNearBudget = categoryUsage.filter(usage => 
      usage.percentage >= 80 && usage.percentage <= 100
    );

    return {
      budgetId: budget.id,
      year,
      month,
      totalBudgeted,
      totalSpent,
      totalRemaining,
      overallPercentage: Math.round(overallPercentage * 100) / 100,
      categoryCount: budget.categories.length,
      categoriesOverBudget: categoriesOverBudget.length,
      categoriesNearBudget: categoriesNearBudget.length,
      categoryUsage,
    };
  }

  async getBudgetAlerts(userId: string): Promise<BudgetAlert[]> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const budget = await this.prisma.budget.findFirst({
      where: { userId, year: currentYear, month: currentMonth },
      include: { 
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!budget) {
      return [];
    }

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0);

    const alerts: BudgetAlert[] = [];

    for (const budgetCategory of budget.categories) {
      const spent = await this.prisma.transaction.aggregate({
        where: {
          userId,
          categoryId: budgetCategory.categoryId,
          type: 'expense',
          txnDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: { amount: true },
      });

      const spentAmount = Number(spent._sum.amount || 0);
      const budgeted = Number(budgetCategory.capAmount);
      const percentage = budgeted > 0 ? (spentAmount / budgeted) * 100 : 0;

      if (percentage >= 80) {
        alerts.push({
          categoryId: budgetCategory.categoryId,
          categoryName: budgetCategory.category.name,
          budgeted,
          spent: spentAmount,
          percentage: Math.round(percentage * 100) / 100,
          severity: percentage >= 100 ? 'high' : percentage >= 90 ? 'medium' : 'low',
          message: percentage >= 100 
            ? `Budget exceeded by ${spentAmount - budgeted}` 
            : `${Math.round((100 - percentage) * 100) / 100}% of budget remaining`,
        });
      }
    }

    return alerts.sort((a, b) => b.percentage - a.percentage);
  }

  async checkBudgetBeforeTransaction(
    userId: string,
    categoryId: string,
    amount: number,
    transactionDate: Date
  ): Promise<{ allowed: boolean; warning?: string }> {
    const year = transactionDate.getFullYear();
    const month = transactionDate.getMonth() + 1;

    const budgetCategory = await this.prisma.bUDGET_CATEGORY.findFirst({
      where: {
        budget: { userId, year, month },
        categoryId,
      },
      include: {
        budget: true,
        category: true,
      },
    });

    if (!budgetCategory) {
      return { allowed: true }; // No budget constraint
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const currentSpent = await this.prisma.transaction.aggregate({
      where: {
        userId,
        categoryId,
        type: 'expense',
        txnDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: { amount: true },
    });

    const totalSpent = Number(currentSpent._sum.amount || 0);
    const budgeted = Number(budgetCategory.capAmount);
    const projectedSpent = totalSpent + amount;
    const projectedPercentage = (projectedSpent / budgeted) * 100;

    if (projectedPercentage > 100) {
      return {
        allowed: false,
        warning: `This transaction would exceed the budget for ${budgetCategory.category.name} by ${projectedSpent - budgeted}`,
      };
    } else if (projectedPercentage > 80) {
      return {
        allowed: true,
        warning: `This transaction will use ${Math.round(projectedPercentage * 100) / 100}% of your ${budgetCategory.category.name} budget`,
      };
    }

    return { allowed: true };
  }

  async createBudgetFromTemplate(
    userId: string, 
    templateBudgetId: string, 
    year: number, 
    month: number
  ): Promise<Budget> {
    // Check if budget already exists for this month/year
    const existing = await this.prisma.budget.findFirst({
      where: { userId, year, month },
    });

    if (existing) {
      throw new ConflictError('Budget already exists for this month');
    }

    const templateBudget = await this.prisma.budget.findFirst({
      where: { id: templateBudgetId, userId },
      include: { categories: true },
    });

    if (!templateBudget) {
      throw new NotFoundError('Template budget not found');
    }

    const budget = await this.prisma.budget.create({
      data: {
        userId,
        year,
        month,
        currency: templateBudget.currency,
        amountTotal: templateBudget.amountTotal,
        categories: {
          create: templateBudget.categories.map((cat) => ({
            categoryId: cat.categoryId,
            capAmount: cat.capAmount,
          })),
        },
      },
      include: { categories: true },
    });

    return this.mapBudget(budget);
  }

  private mapBudget(budget: any): Budget {
    return {
      id: budget.id,
      userId: budget.userId,
      year: budget.year,
      month: budget.month,
      currency: budget.currency,
      amountTotal: budget.amountTotal ? Number(budget.amountTotal) : undefined,
      createdAt: budget.createdAt,
      categories: budget.categories?.map((cat: any) => ({
        id: cat.id,
        budgetId: cat.budgetId,
        categoryId: cat.categoryId,
        capAmount: Number(cat.capAmount),
      })) || [],
    };
  }
}