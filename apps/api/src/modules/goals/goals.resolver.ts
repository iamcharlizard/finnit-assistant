import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { Goal, CreateGoalInput, GoalProgress } from './dto/goal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Resolver(() => Goal)
@UseGuards(JwtAuthGuard)
export class GoalsResolver {
  constructor(private readonly goalsService: GoalsService) {}

  @Query(() => [Goal])
  async goals(@CurrentUser() user: any): Promise<Goal[]> {
    return this.goalsService.findMany(user.id);
  }

  @Query(() => Goal)
  async goal(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ): Promise<Goal> {
    return this.goalsService.findById(id, user.id);
  }

  @Query(() => GoalProgress)
  async goalProgress(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ): Promise<GoalProgress> {
    return this.goalsService.getProgress(id, user.id);
  }

  @Mutation(() => Goal)
  async createGoal(
    @CurrentUser() user: any,
    @Args('input') input: CreateGoalInput,
  ): Promise<Goal> {
    return this.goalsService.create(user.id, input);
  }
}