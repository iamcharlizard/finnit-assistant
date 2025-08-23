import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class Debt {
  @Field()
  id: string;

  @Field()
  userId: string;

  @Field()
  name: string;

  @Field()
  principal: number;

  @Field()
  remainingBalance: number;

  @Field()
  totalPaid: number;

  @Field()
  kind: string; // DebtKind enum

  @Field({ nullable: true })
  interestRateAnnual?: number;

  @Field({ nullable: true })
  minPaymentAmount?: number;

  @Field({ nullable: true })
  monthlyPayment?: number;

  @Field({ nullable: true })
  linkedAccountId?: string;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class DebtPayment {
  @Field()
  id: string;

  @Field()
  debtId: string;

  @Field()
  amount: number;

  @Field()
  date: Date;

  @Field()
  transactionId: string;
}

@ObjectType()
export class DebtPayoffProjection {
  @Field()
  debtId: string;

  @Field()
  debtName: string;

  @Field()
  currentBalance: number;

  @Field()
  monthlyPayment: number;

  @Field()
  payoffDate: Date;

  @Field()
  totalInterest: number;
}

@ObjectType()
export class DebtSummary {
  @Field()
  totalDebt: number;

  @Field()
  totalRemaining: number;

  @Field()
  totalPaid: number;

  @Field()
  totalMonthlyPayments: number;

  @Field(() => [DebtPayoffProjection])
  payoffProjections: DebtPayoffProjection[];
}
