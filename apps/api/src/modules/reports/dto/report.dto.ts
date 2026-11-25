import { ObjectType, Field, InputType, Int, Float } from '@nestjs/graphql';
import { IsString, IsNumber, IsDateString } from 'class-validator';

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

@ObjectType({
  description:
    'Where cashFlowProjection starts from: the current balance and the monthly averages it extends',
})
export class CashFlowBaseline {
  @Field(() => Float, {
    description: 'Sum of the balances of the non-archived accounts',
  })
  currentBalance: number;

  @Field(() => Float, {
    description: 'Average monthly income over the months with data (up to 6)',
  })
  monthlyIncome: number;

  @Field(() => Float, {
    description: 'Average monthly expenses over the months with data (up to 6)',
  })
  monthlyExpenses: number;

  @Field(() => Int, { description: 'Months averaged, from 1 to 6' })
  monthsOfData: number;

  @Field({ description: "The user's first account currency, or MXN" })
  currency: string;
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

@ObjectType({
  description: 'Confirmed income and expenses of one day (transfers left out)',
})
export class DailyCashFlow {
  @Field({ description: 'The day, YYYY-MM-DD' })
  date: string;

  @Field(() => Float)
  income: number;

  @Field(() => Float)
  expenses: number;
}

@ObjectType({
  description:
    'This month so far vs the same days of last month, without what comes every month and has not come yet this month',
})
export class FlowComparison {
  @Field(() => Float, { description: 'This month, from the 1st to today' })
  now: number;

  @Field(() => Float, {
    description:
      "Last month's same days, without monthly sources still to come this month",
  })
  before: number;

  @Field(() => Int, {
    description:
      'Monthly sources still to come this month (left out of before)',
  })
  pendingSources: number;
}

@ObjectType()
export class MonthToDateComparison {
  @Field(() => FlowComparison)
  income: FlowComparison;

  @Field(() => FlowComparison)
  expenses: FlowComparison;
}
