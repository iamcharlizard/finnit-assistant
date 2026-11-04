import {
  ObjectType,
  InputType,
  Field,
  ArgsType,
  Int,
  Float,
  ID,
} from '@nestjs/graphql';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsInt,
  IsDate,
  Min,
  Max,
  MaxLength,
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

@InputType({
  description:
    "Sets an account's balance to what the bank shows. The difference is recorded as an adjustment (not income or spending)",
})
export class SetAccountBalanceInput {
  @Field()
  @IsString()
  accountId: string;

  @Field(() => Float, {
    description:
      'The real balance now. Credit cards: negative is what is owed (e.g. -1500)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  balance: number;

  @Field({ nullable: true, description: 'Default: "Balance update"' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  description?: string;
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

// ============================================================================
// BALANCE BY DAY
// ============================================================================

/** Longest range of days one history request returns. */
export const BALANCE_HISTORY_MAX_DAYS = 366;

@ArgsType()
export class AccountBalanceHistoryArgs {
  @Field()
  @IsString()
  accountId: string;

  @Field({ description: 'First day (local date)' })
  @IsDate()
  from: Date;

  @Field({ description: 'Last day (local date); later than today means today' })
  @IsDate()
  to: Date;
}

@ObjectType({ description: "An account's balance on one day" })
export class AccountBalanceDay {
  @Field({ description: 'The local day' })
  date: Date;

  @Field(() => Float, { description: 'Balance when the day started' })
  openingBalance: number;

  @Field(() => Float, { description: 'Balance when the day ended' })
  closingBalance: number;

  @Field(() => Float, { description: 'Money in that day' })
  inflow: number;

  @Field(() => Float, { description: 'Money out that day (positive)' })
  outflow: number;

  @Field(() => Int, { description: 'Confirmed movements that day' })
  movements: number;

  @Field({
    description:
      'False before the first day the history can be trusted (before the account was added or its imported history, or before an old adjustment of unknown direction)',
  })
  complete: boolean;
}

@ObjectType({
  description:
    "An account's balance day by day, worked out from its current balance and the effect of each movement",
})
export class AccountBalanceHistory {
  @Field(() => ID)
  accountId: string;

  @Field()
  currency: string;

  @Field({ description: 'First trusted day' })
  completeFrom: Date;

  @Field(() => [AccountBalanceDay], { description: 'Newest day first' })
  days: AccountBalanceDay[];
}

@ArgsType()
export class AccountsBalanceHistoryArgs {
  @Field({ description: 'First day (local date)' })
  @IsDate()
  from: Date;

  @Field({ description: 'Last day (local date); later than today means today' })
  @IsDate()
  to: Date;

  @Field({
    nullable: true,
    description:
      'Accounts in this currency; default MXN when there is any, else the most used',
  })
  @IsOptional()
  @IsString()
  currency?: string;
}

@ObjectType({
  description:
    'All the (not archived) accounts in one currency on one day: money available and card debt',
})
export class AccountsBalanceDay {
  @Field({ description: 'The local day' })
  date: Date;

  @Field(() => Float, {
    description: 'Cash, debit, savings and e-wallets when the day started',
  })
  availableOpening: number;

  @Field(() => Float, { description: 'Same, when the day ended' })
  availableClosing: number;

  @Field(() => Float, {
    description: 'Owed on credit cards when the day started (positive)',
  })
  debtOpening: number;

  @Field(() => Float, { description: 'Same, when the day ended' })
  debtClosing: number;

  @Field(() => Int)
  movements: number;

  @Field({ description: "False when any account's history isn't trusted" })
  complete: boolean;
}

@ObjectType()
export class AccountsBalanceHistory {
  /** Null when the user has no accounts. */
  @Field({ nullable: true })
  currency?: string;

  @Field(() => Int, { description: 'Accounts added up' })
  accounts: number;

  @Field(() => [AccountsBalanceDay], { description: 'Newest day first' })
  days: AccountsBalanceDay[];
}
