import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({
  description:
    "What a movement's confirmed statement says before marking it cancelled",
})
export class CancellationCheck {
  @Field(() => String, {
    nullable: true,
    description: "The statement's cut-off (YYYY-MM-DD); null without one",
  })
  statementDate: string | null;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Listed on that statement; null without a statement',
  })
  appears: boolean | null;

  @Field({
    description: 'A credit of the same amount on that statement (its reversal)',
  })
  reversalFound: boolean;
}
