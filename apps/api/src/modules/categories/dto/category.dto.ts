import {
  ObjectType,
  Field,
  InputType,
  ArgsType,
  ID,
  Float,
  Int,
} from '@nestjs/graphql';
import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

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
