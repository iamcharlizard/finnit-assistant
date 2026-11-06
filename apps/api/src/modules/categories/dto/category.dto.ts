import {
  ObjectType,
  Field,
  InputType,
  ArgsType,
  ID,
  Float,
  Int,
} from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
  MaxLength,
  Matches,
} from 'class-validator';
import { CategoryKind } from '@finnit/database';

/** Icon / color keys: short lowercase identifiers the clients know. */
const STYLE_KEY = /^[a-z][a-z0-9_]{0,31}$/;

@InputType()
export class CreateCategoryInput {
  @Field({
    nullable: true,
    description: 'A main category (catalog or own) to hang it from',
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @Field()
  @IsString()
  @MaxLength(60)
  name: string;

  @Field(() => CategoryKind, {
    nullable: true,
    description:
      "Main categories only (a subcategory takes its parent's); defaults to expense",
  })
  @IsOptional()
  @IsEnum(CategoryKind)
  kind?: CategoryKind;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(STYLE_KEY)
  icon?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(STYLE_KEY)
  color?: string | null;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

@InputType()
export class UpdateCategoryInput {
  @Field(() => String, {
    nullable: true,
    description: 'New main category; null makes it a main category',
  })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @Field(() => CategoryKind, { nullable: true })
  @IsOptional()
  @IsEnum(CategoryKind)
  kind?: CategoryKind;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(STYLE_KEY)
  icon?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(STYLE_KEY)
  color?: string | null;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

@ObjectType()
export class CategoryUsage {
  @Field(() => ID)
  categoryId: string;

  @Field()
  categoryName: string;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => Int)
  transactionCount: number;

  @Field(() => Float)
  averageAmount: number;
}

@ArgsType()
export class CategoryUsageArgs {
  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dateFrom?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dateTo?: Date;
}

@InputType()
export class SuggestCategoryInput {
  @Field()
  @IsString()
  merchantName: string;
}

@ObjectType({ description: 'What uses a category (deleting it moves these)' })
export class CategoryReferences {
  @Field(() => Int)
  transactions: number;

  @Field(() => Int)
  children: number;

  @Field(() => Int)
  budgetCaps: number;

  @Field(() => Int)
  rules: number;

  @Field(() => Int)
  aliases: number;

  @Field(() => Int)
  recurring: number;
}
