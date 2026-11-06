import {
  ArgsType,
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TransferSuggestionReason } from '@finnit/database';

import { Transaction } from '../../../common/types/models/transaction.model';
import { PageInfo } from '../../../common/types/pagination.types';
import {
  MAX_ALIAS_NAME_LENGTH,
  MAX_ALIAS_PATTERN_LENGTH,
} from '../../categorization/dto/merchant-alias.dto';

registerEnumType(TransferSuggestionReason, {
  name: 'TransferSuggestionReason',
  description:
    'pair: the opposite movement is in another own account; text: it reads like a transfer; rule: an alias says where it goes',
});

/** What the user says about a suggested transfer. */
export enum TransferSuggestionAction {
  /** It went to one of my accounts: it becomes a transfer. */
  to_account = 'to_account',
  /** It went to someone else: it keeps its type, with a name and category. */
  to_someone = 'to_someone',
  /** Not a transfer, nothing to add. */
  dismiss = 'dismiss',
}

registerEnumType(TransferSuggestionAction, {
  name: 'TransferSuggestionAction',
});

@ObjectType({
  description:
    "A bank movement that looks like a transfer between the user's accounts",
})
export class TransferSuggestion {
  @Field(() => ID)
  id: string;

  @Field(() => TransferSuggestionReason)
  reason: TransferSuggestionReason;

  @Field(() => Transaction)
  transaction: Transaction;

  @Field(() => Transaction, {
    nullable: true,
    description: 'The opposite movement found in another account',
  })
  counterpartTransaction?: Transaction | null;

  @Field(() => ID, {
    nullable: true,
    description: 'The account it probably went to (or came from)',
  })
  counterpartAccountId?: string | null;

  @Field({
    description:
      'Text to remember it by (a "contains" alias pattern), editable by the user',
  })
  suggestedPattern: string;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class TransferSuggestionEdge {
  @Field(() => TransferSuggestion)
  node: TransferSuggestion;

  @Field()
  cursor: string;
}

@ObjectType()
export class TransferSuggestionConnection {
  @Field(() => [TransferSuggestionEdge])
  edges: TransferSuggestionEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

@ArgsType()
export class TransferSuggestionsArgs {
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
export class ConvertToTransferInput {
  @Field(() => ID)
  @IsString()
  transactionId: string;

  @Field(() => ID, { description: 'The account on the other side' })
  @IsString()
  counterpartAccountId: string;

  @Field(() => ID, {
    nullable: true,
    description:
      'The movement already recorded in that account; without it, one is created',
  })
  @IsOptional()
  @IsString()
  counterpartTransactionId?: string | null;
}

@InputType()
export class ResolveTransferSuggestionInput {
  @Field(() => TransferSuggestionAction)
  @IsEnum(TransferSuggestionAction)
  action: TransferSuggestionAction;

  @Field(() => ID, { nullable: true, description: 'to_account: where it went' })
  @IsOptional()
  @IsString()
  accountId?: string | null;

  @Field(() => ID, {
    nullable: true,
    description: 'to_account: the movement already recorded there',
  })
  @IsOptional()
  @IsString()
  counterpartTransactionId?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'to_someone: what it was (shown instead of the bank text)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ALIAS_NAME_LENGTH)
  description?: string | null;

  @Field(() => ID, { nullable: true, description: 'to_someone: its category' })
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description:
      'Create an alias so future movements with this text get the same answer',
  })
  @IsOptional()
  @IsBoolean()
  remember?: boolean;

  @Field(() => String, {
    nullable: true,
    description:
      'remember: the text to recognize (defaults to suggestedPattern)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ALIAS_PATTERN_LENGTH)
  pattern?: string | null;
}
