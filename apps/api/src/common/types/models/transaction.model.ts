import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class Transaction {
  @Field()
  id: string;

  @Field()
  userId: string;

  @Field()
  accountId: string;

  @Field()
  amount: number;

  @Field()
  currency: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  categoryId?: string;

  @Field({ nullable: true })
  merchantName?: string;

  @Field()
  txnDate: Date;

  @Field()
  type: string; // TransactionType enum

  @Field()
  source: string; // TransactionSource enum

  @Field()
  isPending: boolean;

  @Field()
  isRecurringInstance: boolean;

  @Field({ nullable: true })
  externalId?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
