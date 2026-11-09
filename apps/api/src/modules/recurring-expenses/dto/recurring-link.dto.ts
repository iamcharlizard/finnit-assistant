import { Field, Float, ID, ObjectType } from '@nestjs/graphql';
import { OccurrenceStatus, RecurringExpenseKind } from '@finnit/database';

@ObjectType({
  description:
    'A scheduled payment of a recurring expense (not a loan) that an expense may have paid',
})
export class RecurringLinkOption {
  @Field(() => ID)
  occurrenceId: string;

  @Field(() => ID)
  recurringExpenseId: string;

  @Field()
  name: string;

  @Field(() => RecurringExpenseKind)
  kind: RecurringExpenseKind;

  @Field()
  dueDate: Date;

  @Field(() => Float)
  expectedAmount: number;

  @Field(() => OccurrenceStatus)
  status: OccurrenceStatus;

  @Field(() => ID, {
    nullable: true,
    description: 'The category the expense takes when linked',
  })
  categoryId: string | null;

  @Field({ description: 'Clearly the one (date, amount or name)' })
  proposed: boolean;
}
