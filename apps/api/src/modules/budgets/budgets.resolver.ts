import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import {
  Budget,
  CreateBudgetInput,
  UpdateBudgetInput,
  BudgetUsage,
  BudgetSummary,
  BudgetAlert,
  BudgetFromTemplateInput,
} from './dto/budget.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';

@Resolver(() => Budget)
@UseGuards(JwtAuthGuard)
export class BudgetsResolver {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Query(() => [Budget])
  async budgets(@CurrentUser() user: User): Promise<Budget[]> {
    return this.budgetsService.findMany(user.id);
  }

  @Query(() => Budget)
  async budget(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<Budget> {
    return this.budgetsService.findById(id, user.id);
  }

  @Query(() => [BudgetUsage])
  async budgetUsage(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<BudgetUsage[]> {
    return this.budgetsService.getBudgetUsage(id, user.id);
  }

  @Query(() => Budget, { nullable: true })
  async currentBudget(@CurrentUser() user: User): Promise<Budget | null> {
    return this.budgetsService.getCurrentBudget(user.id);
  }

  @Query(() => BudgetSummary)
  async budgetSummary(
    @CurrentUser() user: User,
    @Args('year') year: number,
    @Args('month') month: number,
  ): Promise<BudgetSummary> {
    return this.budgetsService.getBudgetSummary(user.id, year, month);
  }

  @Query(() => [BudgetAlert])
  async budgetAlerts(@CurrentUser() user: User): Promise<BudgetAlert[]> {
    return this.budgetsService.getBudgetAlerts(user.id);
  }

  @Mutation(() => Budget)
  async createBudget(
    @CurrentUser() user: User,
    @Args('input') input: CreateBudgetInput,
  ): Promise<Budget> {
    return this.budgetsService.create(user.id, input);
  }

  @Mutation(() => Budget)
  async updateBudget(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('input') input: UpdateBudgetInput,
  ): Promise<Budget> {
    return this.budgetsService.update(id, user.id, input);
  }

  @Mutation(() => Boolean)
  async deleteBudget(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.budgetsService.delete(id, user.id);
  }

  @Mutation(() => Budget)
  async createBudgetFromTemplate(
    @CurrentUser() user: User,
    @Args('input') input: BudgetFromTemplateInput,
  ): Promise<Budget> {
    return this.budgetsService.createBudgetFromTemplate(
      user.id,
      input.templateBudgetId,
      input.year,
      input.month,
    );
  }
}
