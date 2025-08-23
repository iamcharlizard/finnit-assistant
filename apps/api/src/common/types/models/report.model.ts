import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class MonthlyReport {
  @Field()
  month: number;

  @Field()
  year: number;

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
export class CategoryUsage {
  @Field()
  categoryId: string;

  @Field()
  categoryName: string;

  @Field()
  totalAmount: number;

  @Field()
  averageAmount: number;

  @Field()
  transactionCount: number;
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

@ObjectType()
export class WhatIfResult {
  @Field()
  scenarioName: string;

  @Field()
  finalBalance: number;

  @Field()
  totalSavings: number;

  @Field(() => [CashFlowProjection])
  projections: CashFlowProjection[];
}
