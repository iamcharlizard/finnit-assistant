import { ArgsType, Field, Float, ID, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Linking an expense movement to a payment of a loan, from either side: the
 * movement's detail (pick the loan and the payment) or the loan's detail
 * (pick the movement).
 */

@ObjectType({ description: 'A payment of a loan an expense can be linked to' })
export class LoanLinkTarget {
  @Field(() => ID)
  occurrenceId: string;

  @Field()
  dueDate: Date;

  @Field(() => Float)
  amount: number;

  @Field({
    description:
      'open (to pay), overdue, or paid_without_movement (paid before the loan was registered or unlinked)',
  })
  state: string;
}

@ObjectType({ description: 'A loan and the payments a movement can pay' })
export class LoanLinkLoan {
  @Field(() => ID)
  debtId: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  lenderName?: string;

  @Field(() => [LoanLinkTarget], {
    description: 'Closest to the movement first',
  })
  payments: LoanLinkTarget[];

  @Field(() => ID, {
    nullable: true,
    description:
      'The payment that fits the movement best (same date first), if any',
  })
  suggestedOccurrenceId?: string;
}

@ObjectType({ description: 'Where an expense movement can be linked' })
export class LoanLinkOptions {
  @Field(() => [LoanLinkLoan], { description: 'Best fit first' })
  loans: LoanLinkLoan[];

  @Field(() => ID, { nullable: true })
  suggestedDebtId?: string;
}

@ObjectType({
  description: 'An expense movement that could be a payment of a loan',
})
export class LoanExpenseCandidate {
  @Field(() => ID)
  transactionId: string;

  @Field()
  date: Date;

  @Field(() => Float)
  amount: number;

  @Field()
  description: string;

  @Field()
  accountName: string;

  @Field({ description: 'Its text shares a word with the loan or lender' })
  nameMatch: boolean;

  @Field({ description: 'Within a few cents of the payment' })
  exactAmount: boolean;

  @Field(() => Float, { description: '0..1' })
  score: number;
}

@ArgsType()
export class LoanExpenseCandidatesArgs {
  @Field(() => ID)
  @IsString()
  occurrenceId: string;

  @Field({
    nullable: true,
    description:
      'Text to look for instead (any amount, the last year): when the movement is not among the matches',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}

@ArgsType()
export class UnlinkLoanPaymentArgs {
  @Field(() => ID)
  @IsString()
  occurrenceId: string;

  @Field({
    description:
      'true: the payment stays paid, without a movement; false: back to open',
  })
  @IsBoolean()
  keepPaid: boolean;
}
