import { Field, Float, ObjectType } from '@nestjs/graphql';

import { CategoryExpense } from '../../reports/dto/report.dto';

@ObjectType({
  description:
    'Confirmed spending of the movements that pass some filters, by category',
})
export class TransactionSpending {
  @Field(() => Float, {
    description: 'Every matching expense, with or without a category',
  })
  totalExpenses: number;

  @Field(() => [CategoryExpense], {
    description: 'Per category; what has no category is the rest of the total',
  })
  categoryBreakdown: CategoryExpense[];
}
