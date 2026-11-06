import {
  Args,
  Field,
  Int,
  Mutation,
  ObjectType,
  Resolver,
  registerEnumType,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import { AutoCategorizeMode, SyncReviewService } from './sync-review.service';

registerEnumType(AutoCategorizeMode, {
  name: 'AutoCategorizeMode',
  description:
    'history: past categorizations (applied); ai: AI suggestions to review; both: history, then AI for the rest',
});

@ObjectType()
export class AutoCategorizeResult {
  @Field(() => Int, { description: 'Movements that got a category' })
  categorized: number;

  @Field(() => Int, {
    description: 'Movements with a new suggestion to accept or reject',
  })
  suggested: number;

  @Field(() => Int, { description: 'Movements still without a category' })
  remaining: number;
}

@Resolver()
@UseGuards(JwtAuthGuard)
export class SyncReviewResolver {
  constructor(private readonly review: SyncReviewService) {}

  @Mutation(() => AutoCategorizeResult, {
    description:
      'Categorizes the uncategorized movements: from past categorizations (merchant rules, aliases, history), with AI suggestions to review, or both; refreshes the to-review notification',
  })
  autoCategorizeTransactions(
    @CurrentUser() user: User,
    @Args('mode', {
      type: () => AutoCategorizeMode,
      nullable: true,
      defaultValue: AutoCategorizeMode.history,
    })
    mode: AutoCategorizeMode,
  ): Promise<AutoCategorizeResult> {
    return this.review.categorizeNow(user.id, mode);
  }
}
