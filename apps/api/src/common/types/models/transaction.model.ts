import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Account } from './account.model';
import { Category } from './category.model';
import { Attachment } from './attachment.model';
import {
  Edge,
  Connection,
  PageInfo,
} from '../../../common/types/pagination.types';

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

  @Field(() => Account, { nullable: true })
  account?: Account;

  @Field(() => Category, { nullable: true })
  category?: Category;

  @Field(() => [Attachment], { nullable: true })
  attachments?: Attachment[];
}

@ObjectType()
export class TransactionEdge implements Edge<Transaction> {
  @Field(() => Transaction)
  node: Transaction;

  @Field()
  cursor: string;
}

@ObjectType()
export class TransactionConnection implements Connection<Transaction> {
  @Field(() => [TransactionEdge])
  edges: TransactionEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}
