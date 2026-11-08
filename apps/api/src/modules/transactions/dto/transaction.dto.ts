import {
  Field,
  InputType,
  registerEnumType,
  ArgsType,
  Int,
  ID,
  Float,
} from '@nestjs/graphql';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsDate,
  IsArray,
  ArrayMaxSize,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { TransactionType, TransactionSource } from '@finnit/database';

/** Longest notes a movement takes. */
export const MAX_TRANSACTION_NOTES = 1000;

registerEnumType(TransactionType, {
  name: 'TransactionType',
  description: 'Transaction type',
});

registerEnumType(TransactionSource, {
  name: 'TransactionSource',
  description: 'Transaction source',
});

@InputType()
export class CreateTransactionInput {
  @Field()
  @IsString()
  accountId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Field(() => TransactionType)
  @IsEnum(TransactionType)
  type: TransactionType;

  @Field()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @Field()
  @IsString()
  currency: string;

  @Field()
  @IsDateString()
  txnDate: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  merchantName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isPending?: boolean;
}

@InputType()
export class UpdateTransactionInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  txnDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  merchantName?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Notes on any movement (also from the bank); "" clears them',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TRANSACTION_NOTES)
  notes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isPending?: boolean;

  @Field({
    nullable: true,
    description: 'false: the bank already applied it ("Marcar como aplicado")',
  })
  @IsOptional()
  @IsBoolean()
  inProcess?: boolean;
}

@InputType()
export class TransactionFilters {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  accountId?: string;

  @Field(() => [ID], {
    nullable: true,
    description: 'Movements of any of these accounts',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  accountIds?: string[];

  @Field(() => [ID], {
    nullable: true,
    description:
      'Movements in any of these categories (a parent includes its subcategories)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  categoryIds?: string[];

  @Field(() => Boolean, {
    nullable: true,
    description:
      'With categoryIds: also movements without a category; alone: only those',
  })
  @IsOptional()
  @IsBoolean()
  includeUncategorized?: boolean | null;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Field(() => TransactionType, { nullable: true })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @Field(() => TransactionSource, { nullable: true })
  @IsOptional()
  @IsEnum(TransactionSource)
  source?: TransactionSource;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @Field({
    nullable: true,
    description:
      'Matches the display name, and the original text only for non-private movements',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isPending?: boolean;

  @Field(() => ID, {
    nullable: true,
    description:
      "Only movements shown with this alias rule's automatic name (no one-off name)",
  })
  @IsOptional()
  @IsString()
  aliasId?: string;

  @Field(() => Boolean, {
    nullable: true,
    description:
      'true: only movements without a category; false: only with one',
  })
  @IsOptional()
  @IsBoolean()
  uncategorized?: boolean | null;

  @Field(() => Boolean, {
    nullable: true,
    description:
      'true: only movements that can take a category (expenses and income, not transfers, adjustments or possible transfers waiting for an answer)',
  })
  @IsOptional()
  @IsBoolean()
  categorizable?: boolean | null;

  @Field(() => Boolean, {
    nullable: true,
    description: 'true: only movements with a pending category suggestion',
  })
  @IsOptional()
  @IsBoolean()
  hasSuggestion?: boolean | null;
}

@ArgsType()
export class TransactionsArgs {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  first?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  after?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  last?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  before?: string;

  @Field(() => TransactionFilters, { nullable: true })
  @IsOptional()
  filters?: TransactionFilters;
}

@ArgsType()
export class SimilarTransactionsArgs {
  @Field(() => ID)
  @IsString()
  accountId: string;

  @Field(() => Float)
  @IsNumber()
  amount: number;

  @Field({
    description:
      'Date of the new transaction; matches within 3 days of its local day',
  })
  @IsDate()
  date: Date;

  @Field(() => TransactionType, { nullable: true })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;
}
