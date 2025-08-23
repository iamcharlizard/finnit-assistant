import { ObjectType, Field } from '@nestjs/graphql';
import { Transaction } from './transaction.model';

@ObjectType()
export class Transfer {
  @Field()
  id: string;

  @Field()
  amount: number;

  @Field()
  fromTxnId: string;

  @Field()
  toTxnId: string;

  @Field(() => Transaction)
  fromTxn: Transaction;

  @Field(() => Transaction)
  toTxn: Transaction;

  @Field({ nullable: true })
  description?: string;

  @Field()
  createdAt: Date;
}
