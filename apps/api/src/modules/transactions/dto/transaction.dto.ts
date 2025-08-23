import { ObjectType, Field, InputType, registerEnumType, ArgsType, Int } from '@nestjs/graphql';
import { 
  IsString, 
  IsEnum, 
  IsNumber, 
  IsOptional, 
  IsBoolean, 
  IsDateString, 
  Min, 
  Max 
} from 'class-validator';
import { Connection, Edge } from '../../../common/types/pagination.types';
import { TransactionType, TransactionSource } from '@finnit/database';

registerEnumType(TransactionType, {
  name: 'TransactionType',
  description: 'Transaction type',
});

registerEnumType(TransactionSource, {
  name: 'TransactionSource',
  description: 'Transaction source',
});

@ObjectType()
export class Transaction {
  @Field()
  id: string;

  @Field()
  userId: string;

  @Field()
  accountId: string;

  @Field({ nullable: true })
  categoryId?: string;

  @Field(() => TransactionType)
  type: TransactionType;

  @Field()
  amount: number;

  @Field()
  currency: string;

  @Field()
  txnDate: Date;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  merchantName?: string;

  @Field()
  isPending: boolean;

  @Field()
  isRecurringInstance: boolean;

  @Field(() => TransactionSource)
  source: TransactionSource;

  @Field({ nullable: true })
  externalId?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
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

  @Field()
  pageInfo: any;

  @Field(() => Int)
  totalCount: number;
}

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

@ObjectType()
export class Attachment {
  @Field()
  id: string;

  @Field()
  transactionId: string;

  @Field()
  fileUrl: string;

  @Field()
  fileType: string;

  @Field({ nullable: true })
  fileSize?: number;

  @Field({ nullable: true })
  extra?: any;

  @Field()
  uploadedAt: Date;
}

@InputType()
export class CreateAttachmentInput {
  @Field()
  @IsString()
  transactionId: string;

  @Field()
  @IsString()
  fileUrl: string;

  @Field()
  @IsString()
  fileType: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @Field({ nullable: true })
  @IsOptional()
  extra?: any;
}