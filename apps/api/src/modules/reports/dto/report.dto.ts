import { ObjectType, Field, InputType, Int } from '@nestjs/graphql';
import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';

@ObjectType()
export class MonthlyReport {
  @Field(() => Int)
  year: number;

  @Field(() => Int)
  month: number;

  @Field()
  currency: string;

  @Field()
  totalIncome: number;

  @Field()
  totalExpenses: number;

  @Field()
  netIncome: number;

  @Field(() => [CategoryExpense])
  categoryBreakdown: CategoryExpense[];
}

@ObjectType()
export class CategoryExpense {
  @Field()
  categoryId: string;

  @Field()
  categoryName: string;

  @Field()
  amount: number;

  @Field()
  percentage: number;
}

@ObjectType()
export class CashFlowProjection {
  @Field()
  date: Date;

  @Field()
  projectedBalance: number;

  @Field()
  description: string;
}

@InputType()
export class WhatIfInput {
  @Field()
  @IsString()
  scenarioName: string;

  @Field()
  @IsNumber()
  monthlyIncome: number;

  @Field()
  @IsNumber()
  monthlyExpenses: number;

  @Field()
  @IsDateString()
  startDate: Date;

  @Field(() => Int)
  @IsNumber()
  monthsToProject: number;
}

@ObjectType()
export class WhatIfResult {
  @Field()
  scenarioName: string;

  @Field(() => [CashFlowProjection])
  projections: CashFlowProjection[];

  @Field()
  finalBalance: number;

  @Field()
  totalSavings: number;
}