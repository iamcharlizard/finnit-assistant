import { ObjectType, Field } from '@nestjs/graphql';

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

  @Field()
  currentAmount: number;

  @Field()
  currency: string;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field()
  createdAt: Date;
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
  isCompleted: boolean;

  @Field()
  daysRemaining: number;
}
