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

  @Field()
  pattern: string;

  @Field()
  displayName: string;

  @Field(() => Category, { nullable: true })
  category?: Category | null;

  @Field()
  isPrivate: boolean;

  @Field(() => Int, { description: 'Higher wins when several aliases match' })
  priority: number;

  @Field()
  active: boolean;

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
