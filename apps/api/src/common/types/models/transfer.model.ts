import { ObjectType, Field } from '@nestjs/graphql';
import { Transaction } from './transaction.model';

@ObjectType()
export class Transfer {
  @Field()
  id: string;

  @Field()
  fromTxnId: string;

  @Field()
  toTxnId: string;

  @Field()
  amount: number;

  @Field()
  createdAt: Date;

  @Field(() => Transaction)
  fromTxn: Transaction;

  @Field(() => Transaction)
  toTxn: Transaction;
}
