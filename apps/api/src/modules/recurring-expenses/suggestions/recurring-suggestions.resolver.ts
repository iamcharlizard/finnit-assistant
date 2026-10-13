import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { User } from '../../../common/types/models/user.model';
import { AppLocale, RequestLocale } from '../../translation/locale';
import { RecurringExpense } from '../dto/recurring-expense.dto';
import {
  AcceptRecurringSuggestionInput,
  RecurringSuggestion,
  RecurringSuggestionsArgs,
} from './recurring-suggestion.dto';
import { RecurringSuggestionsService } from './recurring-suggestions.service';

@Resolver(() => RecurringSuggestion)
@UseGuards(JwtAuthGuard)
export class RecurringSuggestionsResolver {
  constructor(private readonly service: RecurringSuggestionsService) {}

  @Query(() => [RecurringSuggestion], {
    description:
      'Recurring payments detected in the movements (not dismissed, not accepted yet), most confident first',
  })
  async recurringSuggestions(
    @CurrentUser() user: User,
    @Args() args: RecurringSuggestionsArgs,
    @RequestLocale() locale: AppLocale,
  ): Promise<RecurringSuggestion[]> {
    return this.service.list(user.id, args.accountId, locale);
  }

  @Mutation(() => RecurringExpense, {
    description:
      'Creates the recurring expense of a suggestion and links its past movements as paid occurrences',
  })
  async acceptRecurringSuggestion(
    @CurrentUser() user: User,
    @Args('fingerprint', { type: () => ID }) fingerprint: string,
    @Args('input', {
      type: () => AcceptRecurringSuggestionInput,
      nullable: true,
    })
    input?: AcceptRecurringSuggestionInput,
  ): Promise<RecurringExpense> {
    return this.service.accept(user.id, fingerprint, input ?? {});
  }

  @Mutation(() => Boolean)
  async dismissRecurringSuggestion(
    @CurrentUser() user: User,
    @Args('fingerprint', { type: () => ID }) fingerprint: string,
  ): Promise<boolean> {
    return this.service.dismiss(user.id, fingerprint);
  }
}
