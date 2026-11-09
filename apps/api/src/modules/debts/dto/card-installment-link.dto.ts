import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

/**
 * Linking an expense on a credit card to a purchase in installments: as the
 * card's charge of the whole purchase, or as the charge of one monthly
 * installment.
 */

@ObjectType({ description: 'An installment of a card purchase to link' })
export class CardInstallmentLinkTarget {
  @Field(() => ID)
  occurrenceId: string;

  @Field(() => Int, { description: 'Which installment: 3 of 12' })
  number: number;

  @Field()
  dueDate: Date;

  @Field(() => Float)
  amount: number;

  @Field({ description: 'Close in amount and date to the movement' })
  fits: boolean;

  @Field({ description: 'open, overdue or paid_without_movement' })
  state: string;
}

@ObjectType({ description: 'A purchase in installments on the same card' })
export class CardInstallmentLinkPlan {
  @Field(() => ID)
  debtId: string;

  @Field()
  name: string;

  @Field(() => Float, { description: 'The whole purchase' })
  principal: number;

  @Field(() => Int)
  installmentsTotal: number;

  @Field(() => Float)
  installmentAmount: number;

  @Field()
  purchaseDate: Date;

  @Field({ description: 'Its purchase already has its charge' })
  purchaseLinked: boolean;

  @Field({
    description:
      'The movement can be its purchase: the purchase has no charge and no installment was linked to a movement',
  })
  canLinkPurchase: boolean;

  @Field({ description: 'The movement is close to the whole purchase' })
  purchaseFits: boolean;

  @Field({ description: "The movement's text names it" })
  nameMatches: boolean;

  @Field(() => [CardInstallmentLinkTarget], {
    description:
      'Installments the movement can be (none once the purchase has its charge: the card bills them)',
  })
  installments: CardInstallmentLinkTarget[];
}

@ObjectType({ description: 'What the movement is linked to now' })
export class CardInstallmentLinked {
  @Field(() => ID)
  debtId: string;

  @Field()
  name: string;

  @Field({ description: 'True: the purchase; false: an installment' })
  purchase: boolean;

  @Field(() => ID, { nullable: true })
  occurrenceId?: string;

  @Field(() => Int, { nullable: true })
  number?: number;

  @Field(() => Int)
  installmentsTotal: number;
}

@ObjectType({
  description:
    'Purchases in installments an expense on a card can be linked to',
})
export class CardInstallmentLinkOptions {
  @Field(() => ID)
  accountId: string;

  @Field(() => CardInstallmentLinked, { nullable: true })
  linked?: CardInstallmentLinked;

  @Field(() => ID, { nullable: true })
  suggestedDebtId?: string;

  @Field(() => ID, {
    nullable: true,
    description: 'The installment to suggest; none = the purchase',
  })
  suggestedOccurrenceId?: string;

  @Field(() => [CardInstallmentLinkPlan], { description: 'Best first' })
  plans: CardInstallmentLinkPlan[];
}
