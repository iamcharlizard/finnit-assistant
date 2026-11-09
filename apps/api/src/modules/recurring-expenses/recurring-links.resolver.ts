import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/types/models/user.model';
import { ValidationError } from '../../common/exceptions/graphql-error.exception';
import './dto/recurring-expense.dto';
import { RecurringLinkOptions } from './dto/recurring-link.dto';
import { RecurringLinksService } from './recurring-links.service';

@Resolver()
@UseGuards(JwtAuthGuard)
export class RecurringLinksResolver {
  constructor(private readonly links: RecurringLinksService) {}

  @Query(() => RecurringLinkOptions, {
    description:
      "The recurring expenses (not loans) an expense may have paid, with their payment in each month around the expense's; those that fit first",
  })
  recurringLinkOptions(
    @CurrentUser() user: User,
    @Args('transactionId', { type: () => ID }) transactionId: string,
  ): Promise<RecurringLinkOptions> {
    return this.links.options(user.id, transactionId);
  }

  @Mutation(() => Boolean, {
    description:
      "Links an expense to a recurring expense's payment of a month (default: the expense's): marks it paid, creating it when it wasn't generated, and gives the expense the recurring expense's category (undo with reopenRecurringPayment)",
  })
  linkRecurringPayment(
    @CurrentUser() user: User,
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('recurringExpenseId', { type: () => ID }) recurringExpenseId: string,
    @Args('month', {
      nullable: true,
      description: "YYYY-MM; default: the expense's month",
    })
    month?: string,
  ): Promise<boolean> {
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new ValidationError('month must be YYYY-MM');
    }
    return this.links.link(user.id, transactionId, recurringExpenseId, month);
  }
}
