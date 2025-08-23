import { ObjectType, Field, InputType } from '@nestjs/graphql';
import { IsString, IsNumber, Min, IsOptional, IsDateString } from 'class-validator';
import { Transaction } from '../../transactions/dto/transaction.dto';

@ObjectType()
export class Transfer {
  @Field()
  id: string;

  @Field()
  fromTxnId: string;

  @Field()
  toTxnId: string;

  @Field()
  amount: number;

  @Field()
  createdAt: Date;

  @Field(() => Transaction)
  fromTxn: Transaction;

  @Field(() => Transaction)
  toTxn: Transaction;
}

@InputType()
export class CreateTransferInput {
  @Field()
  @IsString()
  fromAccountId: string;

  @Field()
  @IsString()
  toAccountId: string;

  @Field()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  txnDate?: Date;
}