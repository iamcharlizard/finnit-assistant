import { ObjectType, Field, InputType } from '@nestjs/graphql';
import { IsString, IsNumber, IsOptional, IsDateString, Min } from 'class-validator';

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

  @Field()
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