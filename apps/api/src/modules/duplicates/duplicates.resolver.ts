import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Transaction } from '../../common/types/models/transaction.model';
import { User } from '../../common/types/models/user.model';
import { DuplicatesService } from './duplicates.service';
import {
  DuplicateSuggestionConnection,
  DuplicateSuggestionsArgs,
  MergeTransactionsInput,
  ResolveDuplicateSuggestionInput,
} from './dto/duplicate.dto';

@Resolver()
@UseGuards(JwtAuthGuard)
export class DuplicatesResolver {
  constructor(private readonly duplicates: DuplicatesService) {}

  @Query(() => [Transaction], {
    description:
      'Movements of the same account that may be this one recorded again (same amount and direction, a few days apart), closest first',
  })
  duplicateCandidates(
    @CurrentUser() user: User,
    @Args('transactionId', { type: () => ID }) transactionId: string,
  ): Promise<Transaction[]> {
    return this.duplicates.candidates(user.id, transactionId);
  }

  @Mutation(() => Transaction, {
    description:
      'Merges two records of the same money: the bank one stays, the other is deleted with its balance; returns the one kept',
  })
  mergeTransactions(
    @CurrentUser() user: User,
    @Args('input') input: MergeTransactionsInput,
  ): Promise<Transaction> {
    return this.duplicates.merge(user.id, input);
  }

  @Query(() => DuplicateSuggestionConnection, {
    description: 'Possible duplicates waiting for the user',
  })
  duplicateSuggestions(
    @CurrentUser() user: User,
    @Args() args: DuplicateSuggestionsArgs,
  ): Promise<DuplicateSuggestionConnection> {
    return this.duplicates.suggestions(user.id, args);
  }

  @Mutation(() => Boolean, {
    description: 'Merge a suggested pair, or say it is not a duplicate',
  })
  resolveDuplicateSuggestion(
    @CurrentUser() user: User,
    @Args('input') input: ResolveDuplicateSuggestionInput,
  ): Promise<boolean> {
    return this.duplicates.resolve(user.id, input);
  }
}
