import { Resolver, Query, Mutation, Args, ID, Float } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GoalsService } from './goals.service';
import {
  Goal,
  CreateGoalInput,
  UpdateGoalInput,
  GoalProgress,
  GoalContribution,
  CreateGoalContributionInput,
  GoalProjection,
  GoalRecommendations,
} from './dto/goal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';

@Resolver(() => Goal)
@UseGuards(JwtAuthGuard)
export class GoalsResolver {
  constructor(private readonly goalsService: GoalsService) {}

  @Query(() => [Goal])
  async goals(@CurrentUser() user: User): Promise<Goal[]> {
    return this.goalsService.findMany(user.id);
  }

  @Query(() => Goal)
  async goal(@CurrentUser() user: User, @Args('id') id: string): Promise<Goal> {
    return this.goalsService.findById(id, user.id);
  }

  @Query(() => GoalProgress)
  async goalProgress(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<GoalProgress> {
    return this.goalsService.getProgress(id, user.id);
  }

  @Query(() => [GoalContribution], { description: 'Newest first' })
  async goalContributions(
    @CurrentUser() user: User,
    @Args('goalId', { type: () => ID }) goalId: string,
  ): Promise<GoalContribution[]> {
    return this.goalsService.getContributions(goalId, user.id);
  }

  @Query(() => GoalProjection)
  async goalProjection(
    @CurrentUser() user: User,
    @Args('goalId', { type: () => ID }) goalId: string,
    @Args('monthlyContribution', {
      type: () => Float,
      nullable: true,
      description:
        'Amount saved per month; defaults to the average of the last 3 months of contributions',
    })
    monthlyContribution?: number,
  ): Promise<GoalProjection> {
    return this.goalsService.getGoalProjection(
      goalId,
      user.id,
      monthlyContribution,
    );
  }

  @Query(() => GoalRecommendations, {
    description: "Over all the user's goals, or only goalId when given",
  })
  async goalRecommendations(
    @CurrentUser() user: User,
    @Args('goalId', { type: () => ID, nullable: true }) goalId?: string,
  ): Promise<GoalRecommendations> {
    return this.goalsService.getGoalRecommendations(user.id, goalId);
  }

  @Mutation(() => Goal)
  async createGoal(
    @CurrentUser() user: User,
    @Args('input') input: CreateGoalInput,
  ): Promise<Goal> {
    return this.goalsService.create(user.id, input);
  }

  @Mutation(() => Goal)
  async updateGoal(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateGoalInput,
  ): Promise<Goal> {
    return this.goalsService.update(id, user.id, input);
  }

  @Mutation(() => Boolean, {
    description: 'Fails while the goal has contributions',
  })
  async deleteGoal(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.goalsService.delete(id, user.id);
  }

  @Mutation(() => GoalContribution)
  async addGoalContribution(
    @CurrentUser() user: User,
    @Args('input') input: CreateGoalContributionInput,
  ): Promise<GoalContribution> {
    return this.goalsService.addContribution(user.id, input);
  }

  @Mutation(() => Boolean)
  async removeGoalContribution(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.goalsService.removeContribution(id, user.id);
  }
}
