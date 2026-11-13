import {
  ObjectType,
  Field,
  Float,
  ID,
  Int,
  registerEnumType,
} from '@nestjs/graphql';
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

@ObjectType({
  description: 'The alias rule that gives a movement its automatic name',
})
export class TransactionAliasRule {
  @Field(() => ID)
  id: string;

  @Field()
  displayName: string;

  @Field()
  isPrivate: boolean;

  @Field({
    description: 'Needs the privacy PIN to see its pattern or the bank text',
  })
  isProtected: boolean;

  @Field(() => String, {
    nullable: true,
    description:
      'What it looks for; null for private movements except in transaction(id), and for protected rules until unlocked',
  })
  pattern: string | null;
}

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

  @Field(() => Float, {
    nullable: true,
    description:
      'What it adds (+) or takes (−) from its account balance; null for old adjustments of unknown direction',
  })
  balanceEffect?: number | null;

  @Field()
  currency: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  categoryId?: string;

  @Field({ nullable: true })
  merchantName?: string;

  @Field(() => String, {
    nullable: true,
    description:
      "The user's notes; null for private movements except in transaction(id)",
  })
  notes?: string | null;

  @Field()
  txnDate: Date;

  @Field()
  type: string; // TransactionType enum

  @Field()
  source: string; // TransactionSource enum

  @Field()
  isPending: boolean;

  @Field({
    description:
      '"En proceso": the bank shows it but hasn\'t applied it yet. It counts in the balance; it clears when the applied movement arrives',
  })
  inProcess: boolean;

  @Field(() => Date, {
    nullable: true,
    description:
      '"Cancelado": when the bank cancelled it (by hand on a credit card, or reported by a bank sync). It stays in the history but counts nowhere',
  })
  cancelledAt?: Date | null;

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

  @Field({
    description:
      "The movement's own privacy flag; isPrivate is also true when its alias rule is private",
  })
  ownPrivate: boolean;

  @Field({
    description:
      'The bank text is hidden behind the privacy PIN (protected rule, request not unlocked)',
  })
  originalLocked: boolean;

  @Field(() => TransactionAliasRule, {
    nullable: true,
    description: 'The alias rule that names this movement (automatic name)',
  })
  aliasRule?: TransactionAliasRule | null;

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
