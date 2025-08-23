import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class Budget {
  @Field()
  id: string;

  @Field()
  userId: string;

  @Field()
  month: number;

  @Field()
  year: number;

  @Field()
  currency: string;

  @Field({ nullable: true })
  amountTotal?: number;

  @Field(() => [BudgetCategory])
  categories: BudgetCategory[];

  @Field()
  createdAt: Date;
}

@ObjectType()
export class BudgetCategory {
  @Field()
  id: string;

  @Field()
  budgetId: string;

  @Field()
  categoryId: string;

  @Field()
  capAmount: number;
}

@ObjectType()
export class BudgetSummary {
  @Field()
  budgetId: string;

  @Field()
  month: number;

  @Field()
  year: number;

  @Field()
  totalBudgeted: number;

  @Field()
  totalSpent: number;

  @Field()
  totalRemaining: number;

  @Field()
  overallPercentage: number;

  @Field()
  categoryCount: number;

  @Field()
  categoriesOverBudget: number;

  @Field()
  categoriesNearBudget: number;

  @Field(() => [BudgetUsage])
  categoryUsage: BudgetUsage[];
}

@ObjectType()
export class BudgetUsage {
  @Field()
  categoryId: string;

  @Field()
  budgeted: number;

  @Field()
  spent: number;

  @Field()
  remaining: number;

  @Field()
  percentage: number;
}

@ObjectType()
export class BudgetAlert {
  @Field()
  categoryId: string;

  @Field()
  categoryName: string;

  @Field()
  budgeted: number;

  @Field()
  spent: number;

  @Field()
  percentage: number;

  @Field()
  severity: string;

  @Field()
  message: string;
}
