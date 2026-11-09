import {
  ArgsType,
  Field,
  Float,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

import { PageInfo } from '../../../common/types/pagination.types';

export enum CreditCardPeriodStatus {
  /** Still running (today is on or before its cut-off). */
  open = 'open',
  /** Closed, its payment not covered yet, before the due date. */
  due = 'due',
  /** The no-interest payment is covered. */
  paid = 'paid',
  /** The due date passed and part of it is still unpaid. */
  unpaid = 'unpaid',
}
registerEnumType(CreditCardPeriodStatus, { name: 'CreditCardPeriodStatus' });

@ObjectType({
  description:
    "A credit card's billing cycle (de corte a corte): what was owed at the cut-off, what was paid towards it by the due date and what is left",
})
export class CreditCardPeriod {
  @Field(() => ID, { description: '<account id>:<cut-off day>' })
  id: string;

  @Field(() => ID)
  accountId: string;

  @Field({ description: 'First day of the cycle' })
  periodStart: Date;

  @Field({ description: 'Cut-off: last day of the cycle' })
  statementDate: Date;

  @Field({ description: 'Last day to pay without interest' })
  paymentDueDate: Date;

  @Field(() => Float, { description: 'Owed at the cut-off' })
  balanceAtStatement: number;

  @Field(() => Float, {
    description:
      'Card installment plans (MSI) due in the cycle and not recorded on the card yet',
  })
  pendingInstallments: number;

  @Field(() => Float, { description: '"Pago para no generar intereses"' })
  noInterestPayment: number;

  @Field(() => Float, { nullable: true, description: 'From a statement' })
  minimumPayment: number | null;

  @Field(() => Float, {
    description: 'Payments and credits between the cut-off and the due date',
  })
  paid: number;

  @Field(() => Float, {
    description: 'What is left of the no-interest payment',
  })
  remaining: number;

  @Field(() => CreditCardPeriodStatus)
  status: CreditCardPeriodStatus;

  @Field({ description: 'The amounts come from an imported statement' })
  fromStatement: boolean;

  @Field({
    description:
      'The card imports from a bank, which records interest by itself',
  })
  connected: boolean;

  @Field(() => Float, {
    nullable: true,
    description:
      'Unpaid cycles of cards added by hand: estimated interest (with VAT) until the next cut-off; needs the interest rate',
  })
  interestEstimate: number | null;

  @Field({
    description:
      'An expense in the interest category is recorded in the next cycle',
  })
  interestRecorded: boolean;

  @Field(() => ID, {
    nullable: true,
    description: 'The "Intereses" category, to record the interest with',
  })
  interestCategoryId: string | null;

  @Field(() => Float, { nullable: true })
  interestRateAnnual: number | null;

  @Field()
  currency: string;
}

@ObjectType()
export class CreditCardPeriodEdge {
  @Field(() => CreditCardPeriod)
  node: CreditCardPeriod;

  @Field()
  cursor: string;
}

@ObjectType()
export class CreditCardPeriodConnection {
  @Field(() => [CreditCardPeriodEdge])
  edges: CreditCardPeriodEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

@ArgsType()
export class CreditCardPeriodsArgs {
  @Field(() => ID)
  @IsString()
  accountId: string;

  @Field(() => Int, { defaultValue: 6 })
  @IsInt()
  @Min(1)
  @Max(24)
  first: number;

  @Field({
    nullable: true,
    description: 'Cursor: the cycles before this cut-off day (YYYY-MM-DD)',
  })
  @IsOptional()
  @Matches(DAY)
  after?: string;
}

@ArgsType()
export class CreditCardPeriodArgs {
  @Field(() => ID)
  @IsString()
  accountId: string;

  @Field({
    nullable: true,
    description:
      'The cycle with this cut-off day (YYYY-MM-DD); default: the last closed one, whose payment is due now',
  })
  @IsOptional()
  @Matches(DAY)
  statementDate?: string;
}
