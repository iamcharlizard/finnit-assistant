import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { 
  Goal, 
  CreateGoalInput, 
  UpdateGoalInput,
  GoalProgress, 
  CreateGoalContributionInput,
  GoalContribution 
} from './dto/goal.dto';
import { NotFoundError, ValidationError, GoalAlreadyReachedError } from '../../common/exceptions/graphql-error.exception';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateGoalInput): Promise<Goal> {
    const goal = await this.prisma.goal.create({
      data: {
        userId,
        name: input.name,
        targetAmount: input.targetAmount,
        dueDate: input.dueDate,
        currency: input.currency,
      },
    });

    return this.mapGoal(goal);
  }

  async findMany(userId: string): Promise<Goal[]> {
    const goals = await this.prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return goals.map(this.mapGoal);
  }

  async findById(id: string, userId: string): Promise<Goal> {
    const goal = await this.prisma.goal.findFirst({
      where: { id, userId },
    });

    if (!goal) {
      throw new NotFoundError('Goal not found');
    }

    return this.mapGoal(goal);
  }

  async getProgress(id: string, userId: string): Promise<GoalProgress> {
    const goal = await this.prisma.goal.findFirst({
      where: { id, userId },
    });

    if (!goal) {
      throw new NotFoundError('Goal not found');
    }

    const targetAmount = Number(goal.targetAmount);
    const currentAmount = Number(goal.currentAmount);
    const percentage = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
    const remaining = targetAmount - currentAmount;

    let daysRemaining: number | undefined = undefined;
    if (goal.dueDate) {
      const now = new Date();
      const dueDate = new Date(goal.dueDate);
      const diffTime = dueDate.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
      goalId: goal.id,
      percentage: Math.round(percentage * 100) / 100,
      remaining: Math.max(0, remaining),
      daysRemaining,
      isCompleted: currentAmount >= targetAmount,
    };
  }

  async update(id: string, userId: string, input: UpdateGoalInput): Promise<Goal> {
    const existingGoal = await this.prisma.goal.findFirst({
      where: { id, userId },
    });

    if (!existingGoal) {
      throw new NotFoundError('Goal not found');
    }

    const updatedGoal = await this.prisma.goal.update({
      where: { id },
      data: input,
    });

    return this.mapGoal(updatedGoal);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const goal = await this.prisma.goal.findFirst({
      where: { id, userId },
      include: { contributions: true },
    });

    if (!goal) {
      throw new NotFoundError('Goal not found');
    }

    if (goal.contributions.length > 0) {
      throw new ValidationError('Cannot delete goal with existing contributions');
    }

    await this.prisma.goal.delete({
      where: { id },
    });

    return true;
  }

  async addContribution(userId: string, input: CreateGoalContributionInput): Promise<GoalContribution> {
    const goal = await this.prisma.goal.findFirst({
      where: { id: input.goalId, userId },
    });

    if (!goal) {
      throw new NotFoundError('Goal not found');
    }

    // Check if goal is already completed
    if (Number(goal.currentAmount) >= Number(goal.targetAmount)) {
      throw new GoalAlreadyReachedError();
    }

    // Validate transaction if provided
    if (input.transactionId) {
      const transaction = await this.prisma.transaction.findFirst({
        where: { id: input.transactionId, userId },
      });

      if (!transaction) {
        throw new NotFoundError('Transaction not found');
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      // Create contribution
      const contribution = await tx.goalContribution.create({
        data: {
          goalId: input.goalId,
          transactionId: input.transactionId,
          amount: input.amount,
          date: input.date,
        },
      });

      // Update goal current amount
      await tx.goal.update({
        where: { id: input.goalId },
        data: {
          currentAmount: {
            increment: input.amount,
          },
        },
      });

      return this.mapGoalContribution(contribution);
    });
  }

  async getContributions(goalId: string, userId: string): Promise<GoalContribution[]> {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new NotFoundError('Goal not found');
    }

    const contributions = await this.prisma.goalContribution.findMany({
      where: { goalId },
      orderBy: { date: 'desc' },
    });

    return contributions.map(this.mapGoalContribution);
  }

  async removeContribution(contributionId: string, userId: string): Promise<boolean> {
    const contribution = await this.prisma.goalContribution.findFirst({
      where: { 
        id: contributionId,
        goal: { userId },
      },
      include: { goal: true },
    });

    if (!contribution) {
      throw new NotFoundError('Contribution not found');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Remove contribution
      await tx.goalContribution.delete({
        where: { id: contributionId },
      });

      // Update goal current amount
      await tx.goal.update({
        where: { id: contribution.goalId },
        data: {
          currentAmount: {
            decrement: contribution.amount,
          },
        },
      });

      return true;
    });
  }

  async getGoalProjection(
    goalId: string, 
    userId: string, 
    monthlyContribution: number
  ): Promise<{ completionDate: Date | null; monthsRemaining: number | null }> {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new NotFoundError('Goal not found');
    }

    const currentAmount = Number(goal.currentAmount);
    const targetAmount = Number(goal.targetAmount);
    const remaining = targetAmount - currentAmount;

    if (remaining <= 0) {
      return { completionDate: null, monthsRemaining: 0 };
    }

    if (monthlyContribution <= 0) {
      return { completionDate: null, monthsRemaining: null };
    }

    const monthsRemaining = Math.ceil(remaining / monthlyContribution);
    const completionDate = new Date();
    completionDate.setMonth(completionDate.getMonth() + monthsRemaining);

    return { completionDate, monthsRemaining };
  }

  async getGoalRecommendations(userId: string): Promise<{
    totalGoalsAmount: number;
    totalSavedAmount: number;
    averageProgress: number;
    recommendedMonthlyContribution: number;
    goalsDueSoon: Goal[];
    goalsAtRisk: Goal[];
  }> {
    const goals = await this.prisma.goal.findMany({
      where: { userId },
      include: { contributions: true },
    });

    if (goals.length === 0) {
      return {
        totalGoalsAmount: 0,
        totalSavedAmount: 0,
        averageProgress: 0,
        recommendedMonthlyContribution: 0,
        goalsDueSoon: [],
        goalsAtRisk: [],
      };
    }

    let totalGoalsAmount = 0;
    let totalSavedAmount = 0;
    let totalProgress = 0;
    const goalsDueSoon: Goal[] = [];
    const goalsAtRisk: Goal[] = [];

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    for (const goal of goals) {
      const targetAmount = Number(goal.targetAmount);
      const currentAmount = Number(goal.currentAmount);
      const progress = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;

      totalGoalsAmount += targetAmount;
      totalSavedAmount += currentAmount;
      totalProgress += progress;

      // Goals due soon (within 30 days)
      if (goal.dueDate && goal.dueDate <= thirtyDaysFromNow && currentAmount < targetAmount) {
        goalsDueSoon.push(this.mapGoal(goal));
      }

      // Goals at risk (less than 50% complete with less than 60 days remaining)
      if (goal.dueDate && progress < 50) {
        const daysRemaining = Math.ceil((goal.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysRemaining <= 60 && daysRemaining > 0) {
          goalsAtRisk.push(this.mapGoal(goal));
        }
      }
    }

    const averageProgress = totalProgress / goals.length;
    const remainingAmount = totalGoalsAmount - totalSavedAmount;
    
    // Simple recommendation: spread remaining amount over 12 months
    const recommendedMonthlyContribution = remainingAmount / 12;

    return {
      totalGoalsAmount,
      totalSavedAmount,
      averageProgress: Math.round(averageProgress * 100) / 100,
      recommendedMonthlyContribution: Math.max(0, recommendedMonthlyContribution),
      goalsDueSoon,
      goalsAtRisk,
    };
  }

  private mapGoal(goal: any): Goal {
    return {
      id: goal.id,
      userId: goal.userId,
      name: goal.name,
      targetAmount: Number(goal.targetAmount),
      dueDate: goal.dueDate,
      currentAmount: Number(goal.currentAmount),
      currency: goal.currency,
      createdAt: goal.createdAt,
    };
  }

  private mapGoalContribution(contribution: any): GoalContribution {
    return {
      id: contribution.id,
      goalId: contribution.goalId,
      transactionId: contribution.transactionId,
      amount: Number(contribution.amount),
      date: contribution.date,
    };
  }
}