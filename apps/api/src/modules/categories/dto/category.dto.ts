import { ObjectType, Field, InputType, ID, Float, Int } from '@nestjs/graphql';
import { IsString, IsOptional, IsBoolean, IsNumber, IsDateString } from 'class-validator';

@ObjectType()
export class Category {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  parentId?: string;

  @Field()
  name: string;

  @Field()
  isDefault: boolean;

  @Field({ nullable: true })
  sortOrder?: number;

  @Field()
  createdAt: Date;

  @Field(() => [Category], { nullable: true })
  children?: Category[];

  @Field(() => Category, { nullable: true })
  parent?: Category;
}

@InputType()
export class CreateCategoryInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  parentId?: string;

  @Field()
  @IsString()
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

@InputType()
export class UpdateCategoryInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  parentId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

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

@InputType()
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