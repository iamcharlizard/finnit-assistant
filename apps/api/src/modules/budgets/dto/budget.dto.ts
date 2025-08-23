import { ObjectType, Field, InputType, Int, Float } from '@nestjs/graphql';
import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

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
export class Budget {
  @Field()
  id: string;

  @Field()
  userId: string;

  @Field(() => Int)
  year: number;

  @Field(() => Int)
  month: number;

  @Field()
  currency: string;

  @Field({ nullable: true })
  amountTotal?: number;

  @Field()
  createdAt: Date;

  @Field(() => [BudgetCategory])
  categories: BudgetCategory[];
}

@InputType()
export class BudgetCategoryInput {
  @Field()
  @IsString()
  categoryId: string;

  @Field()
  @IsNumber()
  @Min(0)
  capAmount: number;
}

@InputType()
export class CreateBudgetInput {
  @Field(() => Int)
  @Min(2020)
  @Max(2100)
  year: number;

  @Field(() => Int)
  @Min(1)
  @Max(12)
  month: number;

  @Field()
  @IsString()
  currency: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountTotal?: number;

  @Field(() => [BudgetCategoryInput])
  categories: BudgetCategoryInput[];
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

@InputType()
export class UpdateBudgetInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountTotal?: number;

  @Field(() => [BudgetCategoryInput], { nullable: true })
  @IsOptional()
  categories?: BudgetCategoryInput[];
}

@ObjectType()
export class BudgetSummary {
  @Field()
  budgetId: string;

  @Field(() => Int)
  year: number;

  @Field(() => Int)
  month: number;

  @Field(() => Float)
  totalBudgeted: number;

  @Field(() => Float)
  totalSpent: number;

  @Field(() => Float)
  totalRemaining: number;

  @Field(() => Float)
  overallPercentage: number;

  @Field(() => Int)
  categoryCount: number;

  @Field(() => Int)
  categoriesOverBudget: number;

  @Field(() => Int)
  categoriesNearBudget: number;

  @Field(() => [BudgetUsage])
  categoryUsage: BudgetUsage[];
}

@ObjectType()
export class BudgetAlert {
  @Field()
  categoryId: string;

  @Field()
  categoryName: string;

  @Field(() => Float)
  budgeted: number;

  @Field(() => Float)
  spent: number;

  @Field(() => Float)
  percentage: number;

  @Field()
  severity: 'low' | 'medium' | 'high';

  @Field()
  message: string;
}

@InputType()
export class BudgetFromTemplateInput {
  @Field()
  @IsString()
  templateBudgetId: string;

  @Field(() => Int)
  @Min(2020)
  @Max(2100)
  year: number;

  @Field(() => Int)
  @Min(1)
  @Max(12)
  month: number;
}