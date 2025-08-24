import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class CreditCardTerms {
  @Field()
  accountId: string;

  @Field()
  statementDay: number;

  @Field()
  paymentDueDay: number;

  @Field({ nullable: true })
  interestRateAnnual?: number;

  @Field({ nullable: true })
  minPaymentRule?: string;

  @Field({ nullable: true })
  gracePeriodDays?: number;

  @Field()
  updatedAt: Date;
}
