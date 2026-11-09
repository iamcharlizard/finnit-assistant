import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import { Debt, UpdateCardInstallmentInput } from './dto/debt.dto';
import { CardInstallmentLinkOptions } from './dto/card-installment-link.dto';
import { CardInstallmentsService } from './card-installments.service';

@Resolver()
@UseGuards(JwtAuthGuard)
export class CardInstallmentsResolver {
  constructor(private readonly installments: CardInstallmentsService) {}

  @Query(() => CardInstallmentLinkOptions, {
    description:
      "Purchases in installments on an expense's card it can be: the whole purchase or one installment (link an installment with linkLoanPayment)",
  })
  async cardInstallmentLinkOptions(
    @CurrentUser() user: User,
    @Args('transactionId', { type: () => ID }) transactionId: string,
  ): Promise<CardInstallmentLinkOptions> {
    return this.installments.linkOptions(user.id, transactionId);
  }

  @Mutation(() => Debt, {
    description:
      "Links an expense as the card's charge of a whole purchase in installments; the card bills its installments from then on",
  })
  async linkCardInstallmentPurchase(
    @CurrentUser() user: User,
    @Args('debtId', { type: () => ID }) debtId: string,
    @Args('transactionId', { type: () => ID }) transactionId: string,
  ): Promise<Debt> {
    return this.installments.linkPurchase(user.id, debtId, transactionId);
  }

  @Mutation(() => Debt, {
    description:
      'Changes the day and amount of one installment of a card purchase (optionally moving the next ones to that day of the following months)',
  })
  async updateCardInstallment(
    @CurrentUser() user: User,
    @Args('input') input: UpdateCardInstallmentInput,
  ): Promise<Debt> {
    return this.installments.updateInstallment(user.id, input);
  }

  @Mutation(() => Debt, {
    description: 'Takes the charge off a purchase in installments',
  })
  async unlinkCardInstallmentPurchase(
    @CurrentUser() user: User,
    @Args('debtId', { type: () => ID }) debtId: string,
  ): Promise<Debt> {
    return this.installments.unlinkPurchase(user.id, debtId);
  }
}
