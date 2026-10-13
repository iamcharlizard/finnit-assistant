import { ObjectType, InputType, Field, ArgsType, Int } from '@nestjs/graphql';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import {
  Connection,
  Edge,
  PageInfo,
} from '../../../common/types/pagination.types';
import { AccountType } from '@finnit/database';
// Importamos el tipo para TypeScript, pero definimos el modelo aquí para GraphQL
import { Account } from '../../../common/types/models/account.model';
import { AccountMetadataInput } from '../../../common/types/models/account-metadata.model';

// ============================================================================
// CONNECTION TYPES
// ============================================================================

@ObjectType()
export class AccountEdge implements Edge<Account> {
  @Field(() => Account, { description: 'The account node' })
  node!: Account;

  @Field(() => String, { description: 'Cursor for pagination' })
  cursor!: string;
}

@ObjectType()
export class AccountConnection implements Connection<Account> {
  @Field(() => [AccountEdge])
  edges: AccountEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

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

  @Field(() => AccountMetadataInput, { nullable: true })
  @IsOptional()
  metadata?: AccountMetadataInput;
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

  @Field(() => AccountMetadataInput, { nullable: true })
  @IsOptional()
  metadata?: AccountMetadataInput;
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

@InputType({
  description:
    'Billing terms of a credit card account (days of the month, 1 to 31)',
})
export class CreditCardTermsInput {
  @Field(() => Int, { description: 'Day of the month the statement closes' })
  @IsInt()
  @Min(1)
  @Max(31)
  statementDay: number;

  @Field(() => Int, { description: 'Day of the month the payment is due' })
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDueDay: number;

  @Field({ nullable: true, description: 'Annual interest rate, percent' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  interestRateAnnual?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  minPaymentRule?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  gracePeriodDays?: number;
}
