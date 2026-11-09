import {
  ArgsType,
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { Transaction } from '../../../common/types/models/transaction.model';
import { PageInfo } from '../../../common/types/pagination.types';

/** Whose name the merged movement shows. */
export enum MergeNameFrom {
  /** The one that stays (the bank's, when there is one). */
  keep = 'keep',
  /** The one that is deleted: its name becomes the kept one's own name. */
  drop = 'drop',
}
registerEnumType(MergeNameFrom, {
  name: 'MergeNameFrom',
  description:
    'keep: the name of the movement that stays (the bank one); drop: the name of the one deleted',
});

export enum DuplicateAction {
  merge = 'merge',
  /** "No es duplicado": never suggested again. */
  dismiss = 'dismiss',
}
registerEnumType(DuplicateAction, { name: 'DuplicateAction' });

@InputType({
  description:
    'Two movements of one account that are the same money: one stays (the bank one, when there is one), the other is deleted',
})
export class MergeTransactionsInput {
  @Field(() => ID)
  @IsString()
  transactionId: string;

  @Field(() => ID, { description: 'The other movement, the same money' })
  @IsString()
  duplicateId: string;

  @Field(() => ID, {
    nullable: true,
    description:
      'Which one stays when neither came from the bank (default: transactionId)',
  })
  @IsOptional()
  @IsString()
  keepId?: string;

  @Field(() => MergeNameFrom, { defaultValue: MergeNameFrom.keep })
  @IsEnum(MergeNameFrom)
  nameFrom: MergeNameFrom;
}

@ObjectType({
  description:
    'Two movements of one account that look like the same money recorded twice',
})
export class DuplicateSuggestion {
  @Field(() => ID)
  id: string;

  @Field(() => Transaction, { description: 'The one that stays (the bank’s)' })
  keep: Transaction;

  @Field(() => Transaction, { description: 'The one merging deletes' })
  drop: Transaction;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class DuplicateSuggestionEdge {
  @Field(() => DuplicateSuggestion)
  node: DuplicateSuggestion;

  @Field()
  cursor: string;
}

@ObjectType()
export class DuplicateSuggestionConnection {
  @Field(() => [DuplicateSuggestionEdge])
  edges: DuplicateSuggestionEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

@ArgsType()
export class DuplicateSuggestionsArgs {
  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  first?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  after?: string | null;
}

@InputType()
export class ResolveDuplicateSuggestionInput {
  @Field(() => ID)
  @IsString()
  id: string;

  @Field(() => DuplicateAction)
  @IsEnum(DuplicateAction)
  action: DuplicateAction;

  @Field(() => MergeNameFrom, { defaultValue: MergeNameFrom.keep })
  @IsEnum(MergeNameFrom)
  nameFrom: MergeNameFrom;
}
