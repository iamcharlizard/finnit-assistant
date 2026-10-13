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
  Min,
  Max,
} from 'class-validator';
import { TransactionType, TransactionSource } from '@finnit/database';

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

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isPending?: boolean;
}

@InputType()
export class TransactionFilters {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  accountId?: string;

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

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isPending?: boolean;
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
