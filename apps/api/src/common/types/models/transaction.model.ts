import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { CategorySource } from '@finnit/database';
import { Account } from './account.model';
import { Category } from './category.model';
import { Attachment } from './attachment.model';
import {
  Edge,
  Connection,
  PageInfo,
} from '../../../common/types/pagination.types';

registerEnumType(CategorySource, {
  name: 'CategorySource',
  description: 'Who set the category (or proposed a pending suggestion)',
});

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

  @Field({
    description:
      'Name to show: one-off alias, else the matching alias rule, else merchantName, else description',
  })
  displayName: string;

  @Field({
    description:
      'Private (one-off or alias rule): description, merchantName and originalDescription are null except in transaction(id)',
  })
  isPrivate: boolean;

  @Field(() => String, {
    nullable: true,
    description:
      'merchantName ?? description, never modified. Null for private movements except in transaction(id)',
  })
  originalDescription?: string | null;

  @Field(() => ID, {
    nullable: true,
    description: 'Merchant alias rule matching this movement',
  })
  aliasId?: string | null;

  @Field({ description: 'A one-off display name is set on this movement' })
  hasOwnAlias: boolean;

  @Field(() => CategorySource, { nullable: true })
  categorySource?: CategorySource | null;

  @Field(() => Category, {
    nullable: true,
    description: 'Pending AI/rule suggestion, not applied until accepted',
  })
  suggestedCategory?: Category | null;
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
