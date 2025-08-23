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
  BudgetFromTemplateInput 
} from './dto/budget.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Resolver(() => Budget)
@UseGuards(JwtAuthGuard)
export class BudgetsResolver {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Query(() => [Budget])
  async budgets(@CurrentUser() user: any): Promise<Budget[]> {
    return this.budgetsService.findMany(user.id);
  }

  @Query(() => Budget)
  async budget(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ): Promise<Budget> {
    return this.budgetsService.findById(id, user.id);
  }

  @Query(() => [BudgetUsage])
  async budgetUsage(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ): Promise<BudgetUsage[]> {
    return this.budgetsService.getBudgetUsage(id, user.id);
  }

  @Query(() => Budget, { nullable: true })
  async currentBudget(@CurrentUser() user: any): Promise<Budget | null> {
    return this.budgetsService.getCurrentBudget(user.id);
  }

  @Query(() => BudgetSummary)
  async budgetSummary(
    @CurrentUser() user: any,
    @Args('year') year: number,
    @Args('month') month: number,
  ): Promise<BudgetSummary> {
    return this.budgetsService.getBudgetSummary(user.id, year, month);
  }

  @Query(() => [BudgetAlert])
  async budgetAlerts(@CurrentUser() user: any): Promise<BudgetAlert[]> {
    return this.budgetsService.getBudgetAlerts(user.id);
  }

  @Mutation(() => Budget)
  async createBudget(
    @CurrentUser() user: any,
    @Args('input') input: CreateBudgetInput,
  ): Promise<Budget> {
    return this.budgetsService.create(user.id, input);
  }

  @Mutation(() => Budget)
  async updateBudget(
    @CurrentUser() user: any,
    @Args('id') id: string,
    @Args('input') input: UpdateBudgetInput,
  ): Promise<Budget> {
    return this.budgetsService.update(id, user.id, input);
  }

  @Mutation(() => Boolean)
  async deleteBudget(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.budgetsService.delete(id, user.id);
  }

  @Mutation(() => Budget)
  async createBudgetFromTemplate(
    @CurrentUser() user: any,
    @Args('input') input: BudgetFromTemplateInput,
  ): Promise<Budget> {
    return this.budgetsService.createBudgetFromTemplate(
      user.id,
      input.templateBudgetId,
      input.year,
      input.month
    );
  }
}