import {
  Field,
  Float,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AliasMatchType } from '@finnit/database';
import { Category } from '../../../common/types/models/category.model';

export const MAX_ALIAS_PATTERN_LENGTH = 200;
export const MAX_ALIAS_NAME_LENGTH = 80;
export const MAX_ALIAS_PRIORITY = 1000;

registerEnumType(AliasMatchType, {
  name: 'AliasMatchType',
  description:
    'How the pattern is compared with the original text (case- and accent-insensitive)',
});

@ObjectType({
  description:
    'Display name (and optional category / privacy) for the movements whose original text matches the pattern',
})
export class MerchantAlias {
  @Field(() => ID)
  id: string;

  @Field(() => AliasMatchType)
  matchType: AliasMatchType;

  @Field(() => String, {
    nullable: true,
    description: 'Null for a protected rule until the privacy PIN is entered',
  })
  pattern: string | null;

  @Field()
  displayName: string;

  @Field({ description: 'Needs the privacy PIN to see or change it' })
  isProtected: boolean;

  @Field({
    description: 'Protected and not unlocked: pattern hidden, changes refused',
  })
  locked: boolean;

  @Field(() => Category, { nullable: true })
  category?: Category | null;

  @Field()
  isPrivate: boolean;

  @Field(() => Int, { description: 'Higher wins when several aliases match' })
  priority: number;

  @Field()
  active: boolean;

  @Field(() => ID, {
    nullable: true,
    description: 'Matching bank movements are suggested as a transfer to it',
  })
  transferAccountId?: string | null;

  @Field(() => Int, { description: 'Movements currently using this alias' })
  matchCount: number;

  @Field()
  createdAt: Date;
}

@InputType()
export class MerchantAliasInput {
  @Field(() => AliasMatchType)
  @IsEnum(AliasMatchType)
  matchType: AliasMatchType;

  @Field({ description: `At most ${MAX_ALIAS_PATTERN_LENGTH} characters` })
  @IsString()
  @MaxLength(MAX_ALIAS_PATTERN_LENGTH)
  pattern: string;

  @Field({ description: `At most ${MAX_ALIAS_NAME_LENGTH} characters` })
  @IsString()
  @MaxLength(MAX_ALIAS_NAME_LENGTH)
  displayName: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  @Min(-MAX_ALIAS_PRIORITY)
  @Max(MAX_ALIAS_PRIORITY)
  priority?: number;

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @Field(() => ID, {
    nullable: true,
    description:
      'One of your accounts: matching bank movements are suggested as a transfer to it',
  })
  @IsOptional()
  @IsString()
  transferAccountId?: string | null;

  @Field({
    nullable: true,
    defaultValue: false,
    description:
      "Needs the privacy PIN to see its pattern, change it or see its movements' bank text (always private)",
  })
  @IsOptional()
  @IsBoolean()
  isProtected?: boolean;
}

@ObjectType()
export class AliasPreviewSample {
  @Field(() => ID)
  transactionId: string;

  @Field()
  original: string;

  @Field()
  date: Date;

  @Field(() => Float)
  amount: number;

  @Field()
  currency: string;
}

@ObjectType()
export class AliasPreview {
  @Field(() => Int, { description: 'Movements the alias would match' })
  count: number;

  @Field(() => Int, {
    description: 'Of those, how many keep their one-off name',
  })
  withOwnName: number;

  @Field(() => Int, {
    description: 'Of those, how many keep the name of a higher-priority rule',
  })
  withOtherRule: number;

  @Field(() => [AliasPreviewSample], {
    description: 'Up to 20, newest first',
  })
  samples: AliasPreviewSample[];
}

@InputType()
export class TransactionAliasInput {
  @Field(() => String, {
    nullable: true,
    description:
      'One-off display name; null or "" clears it, omitted leaves it unchanged',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ALIAS_NAME_LENGTH)
  displayName?: string | null;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Hide the original text; omitted leaves it unchanged',
  })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean | null;
}

@InputType()
export class SuggestAliasPatternInput {
  @Field(() => [ID], {
    description:
      'Movements that should get the name (their bank text is used), 1 to 10',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  transactionIds: string[];

  @Field(() => [ID], {
    nullable: true,
    description: 'Movements that must not match',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  excludeTransactionIds?: string[] | null;
}

export enum AliasPatternSource {
  ai = 'ai',
  heuristic = 'heuristic',
}

registerEnumType(AliasPatternSource, {
  name: 'AliasPatternSource',
  description:
    'ai: proposed by the AI; heuristic: the words the examples share',
});

@ObjectType({ description: 'A proposed pattern for an automatic name' })
export class AliasPatternSuggestion {
  @Field(() => AliasMatchType)
  matchType: AliasMatchType;

  @Field()
  pattern: string;

  @Field({
    description: "What it looks for, in the user's language (may be empty)",
  })
  explanation: string;

  @Field(() => AliasPatternSource)
  source: AliasPatternSource;

  @Field({ description: 'It matches every example (and none of the excluded)' })
  coversAll: boolean;

  @Field({
    description: 'The AI could not be used (disabled, no model or it failed)',
  })
  aiUnavailable: boolean;

  @Field(() => AliasPreview)
  preview: AliasPreview;
}

@ObjectType({ description: 'What the movements an alias names add up to' })
export class AliasSpending {
  @Field(() => Int)
  count: number;

  @Field(() => Float, { description: 'Spent minus received' })
  total: number;

  @Field()
  currency: string;
}
