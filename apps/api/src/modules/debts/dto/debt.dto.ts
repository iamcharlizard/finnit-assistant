import { ObjectType, Field, InputType, ID, Float, registerEnumType } from '@nestjs/graphql';
import { IsString, IsOptional, IsNumber, IsDateString, IsPositive, Min, Max } from 'class-validator';
import { DebtKind } from '@finnit/database';
import { PaginationArgs, PageInfo } from '../../../common/types/pagination.types';

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

@InputType()
export class DebtsArgs extends PaginationArgs {
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

  @Field(() => Float)
  @IsNumber()
  @IsPositive()
  extraPayment: number;

  @Field()
  strategy: 'avalanche' | 'snowball'; // avalanche: highest interest first, snowball: lowest balance first
}