import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/types/models/user.model';
import './dto/recurring-expense.dto';
import { RecurringLinkOption } from './dto/recurring-link.dto';
import { RecurringLinksService } from './recurring-links.service';

@Resolver()
@UseGuards(JwtAuthGuard)
export class RecurringLinksResolver {
  constructor(private readonly links: RecurringLinksService) {}

  @Query(() => [RecurringLinkOption], {
    description:
      'Scheduled payments of recurring expenses (not loans) an expense may have paid, closest first',
  })
  recurringLinkOptions(
    @CurrentUser() user: User,
    @Args('transactionId', { type: () => ID }) transactionId: string,
  ): Promise<RecurringLinkOption[]> {
    return this.links.options(user.id, transactionId);
  }

  @Mutation(() => Boolean, {
    description:
      "Links an expense to the recurring payment it paid: marks it paid and gives the expense the recurring expense's category (undo with reopenRecurringPayment)",
  })
  linkRecurringPayment(
    @CurrentUser() user: User,
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('occurrenceId', { type: () => ID }) occurrenceId: string,
  ): Promise<boolean> {
    return this.links.link(user.id, transactionId, occurrenceId);
  }
}
