import {
  ObjectType,
  Field,
  InputType,
  ArgsType,
  ID,
  Float,
  Int,
  registerEnumType,
} from '@nestjs/graphql';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  OccurrenceMatchSource,
  OccurrenceStatus,
  RecurringExpenseKind,
  RecurringFrequency,
  RecurringTrackingMode,
} from '@finnit/database';
import { PageInfo } from '../../../common/types/pagination.types';

registerEnumType(RecurringExpenseKind, { name: 'RecurringExpenseKind' });
registerEnumType(RecurringTrackingMode, {
  name: 'RecurringTrackingMode',
  description:
    'automatic: charged by itself, marked paid when reconciled with a statement or bank movement. manual: the user confirms the payment. reminder: only reminds, no payment state.',
});
registerEnumType(RecurringFrequency, {
  name: 'RecurringFrequency',
  description:
    'biweekly = every 14 days; semimonthly = the 15th and the last day of each month.',
});
registerEnumType(OccurrenceStatus, { name: 'OccurrenceStatus' });
registerEnumType(OccurrenceMatchSource, { name: 'OccurrenceMatchSource' });

@ObjectType()
export class RecurringExpense {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => RecurringExpenseKind)
  kind: RecurringExpenseKind;

  @Field(() => RecurringTrackingMode)
  trackingMode: RecurringTrackingMode;

  @Field(() => RecurringFrequency)
  frequency: RecurringFrequency;

  @Field(() => Int)
  interval: number;

  @Field()
  startDate: Date;

  @Field({ nullable: true })
  endDate?: Date;

  @Field(() => Float)
  amount: number;

  @Field()
  isVariableAmount: boolean;

  @Field()
  currency: string;

  @Field({ nullable: true })
  accountId?: string;

  @Field({ nullable: true })
  categoryId?: string;

  @Field({ nullable: true })
  debtId?: string;

  @Field({ nullable: true })
  merchantPattern?: string;

  @Field(() => Int, { nullable: true })
  installmentsTotal?: number;

  @Field(() => Int)
  installmentsPaid: number;

  @Field()
  active: boolean;

  @Field({ nullable: true })
  notes?: string;

  @Field({ nullable: true })
  nextDueDate?: Date;

  @Field(() => Float, { description: 'Average cost per month of this expense' })
  monthlyCost: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class RecurringExpenseEdge {
  @Field(() => RecurringExpense)
  node: RecurringExpense;

  @Field()
  cursor: string;
}

@ObjectType()
export class RecurringExpenseConnection {
  @Field(() => [RecurringExpenseEdge])
  edges: RecurringExpenseEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

@ObjectType()
export class RecurringOccurrence {
  @Field(() => ID)
  id: string;

  @Field()
  recurringExpenseId: string;

  @Field()
  dueDate: Date;

  @Field(() => Float)
  expectedAmount: number;

  @Field(() => OccurrenceStatus)
  status: OccurrenceStatus;

  @Field({ nullable: true })
  transactionId?: string;

  @Field({ nullable: true })
  paidAt?: Date;

  @Field(() => OccurrenceMatchSource, { nullable: true })
  matchedBy?: OccurrenceMatchSource;
}

@ObjectType({
  description:
    'A due payment. Reminder-only expenses have no occurrence: occurrenceId and status are null.',
})
export class UpcomingPayment {
  @Field({ nullable: true })
  occurrenceId?: string;

  @Field(() => RecurringExpense)
  recurringExpense: RecurringExpense;

  @Field()
  dueDate: Date;

  @Field(() => Float)
  expectedAmount: number;

  @Field(() => OccurrenceStatus, { nullable: true })
  status?: OccurrenceStatus;
}

@ObjectType()
export class RecurringKindTotal {
  @Field(() => RecurringExpenseKind)
  kind: RecurringExpenseKind;

  @Field()
  currency: string;

  @Field(() => Int)
  count: number;

  @Field(() => Float)
  monthlyCost: number;
}

@ObjectType()
export class RecurringAccountTotal {
  @Field({
    nullable: true,
    description: 'Null for expenses without an account',
  })
  accountId?: string;

  @Field({ nullable: true })
  accountName?: string;

  @Field()
  currency: string;

  @Field(() => Int)
  count: number;

  @Field(() => Float)
  monthlyCost: number;
}

@ObjectType()
export class RecurringCurrencyTotal {
  @Field()
  currency: string;

  @Field(() => Float)
  monthlyCost: number;
}

@ObjectType()
export class RecurringExpensesSummary {
  @Field(() => [RecurringCurrencyTotal])
  totals: RecurringCurrencyTotal[];

  @Field(() => [RecurringKindTotal])
  byKind: RecurringKindTotal[];

  @Field(() => [RecurringAccountTotal])
  byAccount: RecurringAccountTotal[];
}

@InputType()
export class CreateRecurringExpenseInput {
  @Field()
  @IsString()
  name: string;

  @Field(() => RecurringExpenseKind)
  @IsEnum(RecurringExpenseKind)
  kind: RecurringExpenseKind;

  @Field(() => RecurringTrackingMode)
  @IsEnum(RecurringTrackingMode)
  trackingMode: RecurringTrackingMode;

  @Field(() => RecurringFrequency)
  @IsEnum(RecurringFrequency)
  frequency: RecurringFrequency;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  interval?: number;

  @Field({ description: 'First due date; later dates keep its day of month' })
  @IsDate()
  startDate: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  endDate?: Date;

  @Field(() => Float)
  @IsNumber()
  @IsPositive()
  amount: number;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  isVariableAmount?: boolean;

  @Field({ nullable: true, defaultValue: 'MXN' })
  @IsOptional()
  @IsString()
  currency?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  accountId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  debtId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  merchantPattern?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  installmentsTotal?: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  installmentsPaid?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType()
export class UpdateRecurringExpenseInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => RecurringExpenseKind, { nullable: true })
  @IsOptional()
  @IsEnum(RecurringExpenseKind)
  kind?: RecurringExpenseKind;

  @Field(() => RecurringTrackingMode, { nullable: true })
  @IsOptional()
  @IsEnum(RecurringTrackingMode)
  trackingMode?: RecurringTrackingMode;

  @Field(() => RecurringFrequency, { nullable: true })
  @IsOptional()
  @IsEnum(RecurringFrequency)
  frequency?: RecurringFrequency;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  interval?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  endDate?: Date;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isVariableAmount?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  accountId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  debtId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  merchantPattern?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  installmentsTotal?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  installmentsPaid?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@ArgsType()
export class RecurringExpensesArgs {
  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  first?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  after?: string;

  @Field(() => RecurringExpenseKind, { nullable: true })
  @IsOptional()
  kind?: RecurringExpenseKind;

  @Field(() => RecurringTrackingMode, { nullable: true })
  @IsOptional()
  trackingMode?: RecurringTrackingMode;

  @Field({ nullable: true })
  @IsOptional()
  accountId?: string;

  @Field({ nullable: true, description: 'Defaults to active expenses only' })
  @IsOptional()
  active?: boolean;
}

@ArgsType()
export class UpcomingPaymentsArgs {
  @Field()
  @IsDate()
  from: Date;

  @Field()
  @IsDate()
  to: Date;

  @Field({ nullable: true })
  @IsOptional()
  accountId?: string;
}
