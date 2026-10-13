import { Field, ID, ObjectType } from '@nestjs/graphql';

/**
 * What a movement is linked to, for the movement's detail screen. Each is
 * resolved with its own query per movement: ask for them on `transaction(id)`,
 * not on lists.
 */
@ObjectType({ description: 'The other side of a transfer' })
export class TransferCounterpart {
  @Field(() => ID)
  transactionId: string;

  @Field(() => ID)
  accountId: string;

  @Field({ description: "The account's nickname, else its name" })
  accountName: string;

  @Field({ description: '"out" when this movement is the source side' })
  direction: string;
}

@ObjectType({ description: 'The recurring payment a movement paid' })
export class TransactionRecurringPayment {
  @Field(() => ID)
  occurrenceId: string;

  @Field(() => ID)
  recurringExpenseId: string;

  @Field()
  name: string;

  @Field()
  dueDate: Date;
}
