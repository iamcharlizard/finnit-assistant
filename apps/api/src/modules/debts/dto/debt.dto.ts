import {
  ObjectType,
  Field,
  InputType,
  ArgsType,
  ID,
  Float,
  Int,
  registerEnumType,
} from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsPositive,
  Min,
  Max,
} from 'class-validator';
import { DebtKind } from '@finnit/database';
import { PageInfo } from '../../../common/types/pagination.types';

registerEnumType(DebtKind, {
  name: 'DebtKind',
});

@ObjectType()
export class Debt {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  name: string;

  @Field(() => DebtKind)
  kind: DebtKind;

  @Field(() => Float)
  principal: number;

  @Field(() => Float, { nullable: true })
  interestRateAnnual?: number;

  @Field(() => Float, { nullable: true })
  minPaymentAmount?: number;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field({ nullable: true })
  linkedAccountId?: string;

  @Field()
  createdAt: Date;

  // Computed fields
  @Field(() => Float)
  remainingBalance: number;

  @Field(() => Float)
  totalPaid: number;

  @Field(() => Float, { nullable: true })
  monthlyPayment?: number;
}

@ObjectType()
export class DebtPayment {
  @Field(() => ID)
  id: string;

  @Field()
  debtId: string;

  @Field()
  transactionId: string;

  @Field(() => Float)
  amount: number;

  @Field()
  date: Date;
}

@ObjectType()
export class DebtSummary {
  @Field(() => Float)
  totalDebt: number;

  @Field(() => Float)
  totalPaid: number;

  @Field(() => Float)
  totalRemaining: number;

  @Field(() => Float)
  totalMonthlyPayments: number;

  @Field(() => [DebtPayoffProjection])
  payoffProjections: DebtPayoffProjection[];
}

@ObjectType()
export class DebtPayoffProjection {
  @Field()
  debtId: string;

  @Field()
  debtName: string;

  @Field(() => Float)
  currentBalance: number;

  @Field(() => Float)
  monthlyPayment: number;

  @Field()
  payoffDate: Date;

  @Field(() => Float)
  totalInterest: number;

  @Field(() => Int, {
    nullable: true,
    description:
      'Months until the debt is paid off; null when the payments never pay it off (they do not cover the interest, or the debt gets no payment)',
  })
  monthsToPayoff?: number | null;
}

@ObjectType()
export class DebtConnection {
  @Field(() => [DebtEdge])
  edges: DebtEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field()
  totalCount: number;
}

@ObjectType()
export class DebtEdge {
  @Field(() => Debt)
  node: Debt;

  @Field()
  cursor: string;
}

@InputType()
export class CreateDebtInput {
  @Field()
  @IsString()
  name: string;

  @Field(() => DebtKind)
  kind: DebtKind;

  @Field(() => Float)
  @IsNumber()
  @IsPositive()
  principal: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRateAnnual?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  minPaymentAmount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  linkedAccountId?: string;
}

@InputType()
export class UpdateDebtInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => DebtKind, { nullable: true })
  @IsOptional()
  kind?: DebtKind;

  @Field(() => Float, {
    nullable: true,
    description: 'Cannot be less than what has been paid already',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  principal?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRateAnnual?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  minPaymentAmount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  linkedAccountId?: string;
}

@InputType()
export class CreateDebtPaymentInput {
  @Field()
  @IsString()
  debtId: string;

  @Field()
  @IsString()
  transactionId: string;

  @Field(() => Float)
  @IsNumber()
  @IsPositive()
  amount: number;

  @Field()
  @IsDateString()
  date: Date;
}

@ArgsType()
export class DebtsArgs {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  first?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  after?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  last?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  before?: string;

  @Field(() => DebtKind, { nullable: true })
  @IsOptional()
  kind?: DebtKind;

  @Field({ nullable: true })
  @IsOptional()
  includePayoffProjections?: boolean;
}

@InputType()
export class PayoffStrategyInput {
  @Field(() => [String])
  debtIds: string[];

  @Field(() => Float, { description: 'Extra paid each month; 0 or more' })
  @IsNumber()
  @Min(0)
  extraPayment: number;

  @Field()
  strategy: 'avalanche' | 'snowball'; // avalanche: highest interest first, snowball: lowest balance first
}
