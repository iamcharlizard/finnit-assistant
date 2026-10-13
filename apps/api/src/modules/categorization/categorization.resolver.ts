import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import { Transaction } from '../../common/types/models/transaction.model';
import { CategorizationService } from './categorization.service';
import { MerchantRule } from './dto/merchant-rule.dto';
import { MerchantRulesService } from './merchant-rules.service';

@Resolver()
@UseGuards(JwtAuthGuard)
export class CategorizationResolver {
  constructor(
    private readonly categorization: CategorizationService,
    private readonly rules: MerchantRulesService,
  ) {}

  @Query(() => [MerchantRule], {
    description: 'Learned merchant → category rules, most recent first',
  })
  async merchantRules(@CurrentUser() user: User): Promise<MerchantRule[]> {
    return this.rules.list(user.id);
  }

  @Mutation(() => Boolean)
  async deleteMerchantRule(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.rules.delete(user.id, id);
  }

  @Mutation(() => Int, {
    description:
      'Moves movements (max 500) to a category; with createRule, learns a merchant rule per merchant. Returns how many changed',
  })
  async categorizeTransactions(
    @CurrentUser() user: User,
    @Args('ids', { type: () => [ID] }) ids: string[],
    @Args('categoryId', { type: () => ID }) categoryId: string,
    @Args('createRule', {
      type: () => Boolean,
      nullable: true,
      defaultValue: true,
    })
    createRule: boolean | null,
  ): Promise<number> {
    return this.categorization.categorize(
      user.id,
      ids,
      categoryId,
      createRule ?? true,
    );
  }

  @Mutation(() => [Transaction], {
    description:
      'Suggests a category for uncategorized movements (max 100): merchant rules first, then one AI call. Returns them with suggestedCategory set; without AI only rule suggestions appear',
  })
  async suggestTransactionCategories(
    @CurrentUser() user: User,
    @Args('ids', { type: () => [ID] }) ids: string[],
  ): Promise<Transaction[]> {
    return this.categorization.suggest(user.id, ids);
  }

  @Mutation(() => Int, {
    description:
      'Applies the pending suggestions and learns merchant rules; returns how many were applied',
  })
  async acceptCategorySuggestions(
    @CurrentUser() user: User,
    @Args('ids', { type: () => [ID] }) ids: string[],
  ): Promise<number> {
    return this.categorization.accept(user.id, ids);
  }

  @Mutation(() => Int, {
    description: 'Discards the pending suggestions; returns how many',
  })
  async rejectCategorySuggestions(
    @CurrentUser() user: User,
    @Args('ids', { type: () => [ID] }) ids: string[],
  ): Promise<number> {
    return this.categorization.reject(user.id, ids);
  }
}
