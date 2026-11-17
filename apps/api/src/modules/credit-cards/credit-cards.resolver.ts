import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/types/models/user.model';
import { CreditCardsService } from './credit-cards.service';
import {
  CreditCardPeriod,
  CreditCardPeriodArgs,
  CreditCardPeriodConnection,
  CreditCardPeriodsArgs,
  CreditUsage,
  CreditUsageArgs,
} from './dto/credit-card.dto';

@Resolver()
@UseGuards(JwtAuthGuard)
export class CreditCardsResolver {
  constructor(private readonly cards: CreditCardsService) {}

  @Query(() => CreditCardPeriodConnection, {
    description:
      "A credit card's billing cycles, newest (the running one) first; empty for other accounts and cards without cut-off and payment days",
  })
  creditCardPeriods(
    @CurrentUser() user: User,
    @Args() args: CreditCardPeriodsArgs,
  ): Promise<CreditCardPeriodConnection> {
    return this.cards.periods(user.id, args.accountId, args.first, args.after);
  }

  @Query(() => CreditCardPeriod, {
    nullable: true,
    description:
      'One billing cycle (default: the last closed one, whose payment is due now); null for other accounts and cards without cut-off and payment days',
  })
  creditCardPeriod(
    @CurrentUser() user: User,
    @Args() args: CreditCardPeriodArgs,
  ): Promise<CreditCardPeriod | null> {
    return this.cards.period(user.id, args.accountId, args.statementDate);
  }

  @Query(() => CreditUsage, {
    nullable: true,
    description:
      'What a credit card owes, split into one-off spending and purchases in installments; null for other accounts',
  })
  creditUsage(
    @CurrentUser() user: User,
    @Args() args: CreditUsageArgs,
  ): Promise<CreditUsage | null> {
    return this.cards.creditUsage(user.id, args.accountId);
  }
}
