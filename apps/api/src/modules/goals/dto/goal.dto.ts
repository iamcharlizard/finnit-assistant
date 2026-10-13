import { ObjectType, Field, InputType, Int, Float } from '@nestjs/graphql';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';

@ObjectType()
export class Goal {
  @Field()
  id: string;

  @Field()
  userId: string;

  @Field()
  name: string;

  @Field()
  targetAmount: number;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field()
  currentAmount: number;

  @Field()
  currency: string;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class GoalContribution {
  @Field()
  id: string;

  @Field()
  goalId: string;

  @Field({ nullable: true })
  transactionId?: string;

  @Field()
  amount: number;

  @Field()
  date: Date;
}

@ObjectType()
export class GoalProgress {
  @Field()
  goalId: string;

  @Field()
  percentage: number;

  @Field()
  remaining: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Days until the due date; null when the goal has none',
  })
  daysRemaining?: number;

  @Field()
  isCompleted: boolean;
}

@InputType()
export class CreateGoalInput {
  @Field()
  @IsString()
  name: string;

  @Field()
  @IsNumber()
  @Min(0.01)
  targetAmount: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: Date;

  @Field()
  @IsString()
  currency: string;
}

@InputType()
export class UpdateGoalInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  targetAmount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: Date;
}

@InputType()
export class CreateGoalContributionInput {
  @Field()
  @IsString()
  goalId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @Field()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @Field()
  @IsDateString()
  date: Date;
}

@ObjectType()
export class GoalProjection {
  @Field()
  goalId: string;

  @Field(() => Float, {
    description:
      'Monthly amount used for the projection (the one given, or the average of the last 3 months of contributions)',
  })
  monthlyContribution: number;

  @Field(() => Int, {
    nullable: true,
    description:
      '0 when the goal is reached; null when the monthly contribution is 0',
  })
  monthsRemaining?: number;

  @Field({ nullable: true })
  completionDate?: Date;
}

@ObjectType()
export class GoalRecommendations {
  @Field(() => Float)
  totalGoalsAmount: number;

  @Field(() => Float)
  totalSavedAmount: number;

  @Field(() => Float, { description: 'Average progress, percent' })
  averageProgress: number;

  @Field(() => Float, {
    description: 'Remaining amount spread over 12 months',
  })
  recommendedMonthlyContribution: number;

  @Field(() => [Goal], { description: 'Unfinished goals due within 30 days' })
  goalsDueSoon: Goal[];

  @Field(() => [Goal], {
    description: 'Goals under 50% with 60 days or less left',
  })
  goalsAtRisk: Goal[];
}
