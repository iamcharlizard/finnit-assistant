import {
  ArgsType,
  Field,
  Float,
  ID,
  InputType,
  Int,
  ObjectType,
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
  MaxLength,
  Min,
} from 'class-validator';
import {
  RecurringExpenseKind,
  RecurringFrequency,
  RecurringTrackingMode,
} from '@finnit/database';
import { Account } from '../../../common/types/models/account.model';
import { Category } from '../../../common/types/models/category.model';
// Registers the recurring enums with GraphQL.
import '../dto/recurring-expense.dto';

@ObjectType()
export class RecurringSuggestionOccurrence {
  @Field(() => ID)
  transactionId: string;

  @Field()
  date: Date;

  @Field(() => Float)
  amount: number;
}

@ObjectType({
  description:
    'A recurring payment detected in the synced movements, not saved yet',
})
export class RecurringSuggestion {
  @Field(() => ID, {
    description: 'Stable id of the detected group (merchant + currency)',
  })
  fingerprint: string;

  @Field({ description: 'Normalized merchant, e.g. "APPLE COM BILL"' })
  merchant: string;

  @Field({ description: 'AI name if classified, else the merchant' })
  suggestedName: string;

  @Field(() => RecurringExpenseKind)
  kind: RecurringExpenseKind;

  @Field(() => Category, { nullable: true })
  category?: Category;

  @Field(() => RecurringFrequency)
  frequency: RecurringFrequency;

  @Field(() => Int)
  interval: number;

  @Field(() => Float, { description: 'Median of the occurrences' })
  amount: number;

  @Field()
  isVariableAmount: boolean;

  @Field()
  currency: string;

  @Field(() => Account, { nullable: true })
  account?: Account;

  @Field({ description: 'Last occurrence + cadence (date only)' })
  nextDueDate: Date;

  @Field(() => [RecurringSuggestionOccurrence], {
    description: 'Newest first',
  })
  occurrences: RecurringSuggestionOccurrence[];

  @Field(() => Float, { description: '0..1' })
  confidence: number;

  @Field(() => String, {
    nullable: true,
    description: '"ai" when the AI named and classified it',
  })
  classifiedBy?: string | null;
}

@ArgsType()
export class RecurringSuggestionsArgs {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  accountId?: string;
}

@InputType({
  description: 'Overrides of the suggested values; omitted fields keep them',
})
export class AcceptRecurringSuggestionInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @Field(() => RecurringExpenseKind, { nullable: true })
  @IsOptional()
  @IsEnum(RecurringExpenseKind)
  kind?: RecurringExpenseKind;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isVariableAmount?: boolean;

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

  @Field(() => RecurringTrackingMode, { nullable: true })
  @IsOptional()
  @IsEnum(RecurringTrackingMode)
  trackingMode?: RecurringTrackingMode;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  accountId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  startDate?: Date;
}
