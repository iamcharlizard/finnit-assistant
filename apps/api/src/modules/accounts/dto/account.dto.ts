import { ObjectType, Field, InputType, registerEnumType, ArgsType, Int } from '@nestjs/graphql';
import { IsString, IsEnum, IsDecimal, IsOptional, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { Connection, Edge } from '../../../common/types/pagination.types';
import { AccountType } from '@finnit/database';

registerEnumType(AccountType, {
  name: 'AccountType',
  description: 'Account type',
});

@ObjectType()
export class Account {
  @Field()
  id: string;

  @Field()
  userId: string;

  @Field(() => AccountType)
  type: AccountType;

  @Field()
  name: string;

  @Field()
  currency: string;

  @Field()
  balanceCurrent: number;

  @Field({ nullable: true })
  metadata?: any;

  @Field()
  archived: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class AccountEdge implements Edge<Account> {
  @Field(() => Account)
  node: Account;

  @Field()
  cursor: string;
}

@ObjectType()
export class AccountConnection implements Connection<Account> {
  @Field(() => [AccountEdge])
  edges: AccountEdge[];

  @Field()
  pageInfo: any;

  @Field(() => Int)
  totalCount: number;
}

@InputType()
export class CreateAccountInput {
  @Field(() => AccountType)
  @IsEnum(AccountType)
  type: AccountType;

  @Field()
  @IsString()
  name: string;

  @Field()
  @IsString()
  currency: string;

  @Field()
  @IsNumber()
  initialBalance: number;

  @Field({ nullable: true })
  @IsOptional()
  metadata?: any;
}

@InputType()
export class UpdateAccountInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  metadata?: any;
}

@InputType()
export class AdjustBalanceInput {
  @Field()
  @IsString()
  accountId: string;

  @Field()
  @IsNumber()
  amount: number;

  @Field()
  @IsString()
  description: string;
}

@ArgsType()
export class AccountsArgs {
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

  @Field(() => AccountType, { nullable: true })
  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}