import {
  ArgsType,
  Field,
  Float,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  ImportedLineKind,
  ImportedLineStatus,
  OccurrenceStatus,
  StatementSource,
  StatementStatus,
} from '@finnit/database';
import { PageInfo } from '../../../common/types/pagination.types';

registerEnumType(StatementSource, { name: 'StatementSource' });
registerEnumType(StatementStatus, {
  name: 'StatementStatus',
  description:
    'uploaded → processing → needs_review (extracted, waiting for confirmation) → confirmed; failed on errors.',
});
registerEnumType(ImportedLineKind, { name: 'StatementLineKind' });
registerEnumType(ImportedLineStatus, {
  name: 'StatementLineStatus',
  description:
    'pending: becomes a new transaction on confirm. matched: already registered. created: transaction created on confirm. ignored: skipped.',
});

@ObjectType({ description: 'The recurring payment a statement line pays' })
export class StatementLineRecurringPayment {
  @Field(() => ID)
  occurrenceId: string;

  @Field(() => ID)
  recurringExpenseId: string;

  @Field()
  name: string;

  @Field()
  dueDate: Date;
}

@ObjectType()
export class StatementLine {
  @Field(() => ID)
  id: string;

  @Field()
  date: Date;

  @Field({ nullable: true })
  postDate?: Date;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  merchant?: string;

  @Field(() => Float, { description: 'Positive; `kind` gives the direction' })
  amount: number;

  @Field()
  currency: string;

  @Field(() => ImportedLineKind)
  kind: ImportedLineKind;

  @Field(() => ImportedLineStatus)
  status: ImportedLineStatus;

  @Field(() => Int, { nullable: true })
  installmentNumber?: number;

  @Field(() => Int, { nullable: true })
  installmentTotal?: number;

  @Field({ nullable: true })
  suggestedCategoryId?: string;

  @Field({ nullable: true, description: 'Existing or created transaction' })
  matchedTransactionId?: string;

  @Field({ nullable: true, description: 'Recurring payment this line pays' })
  matchedOccurrenceId?: string;

  @Field(() => StatementLineRecurringPayment, {
    nullable: true,
    description: 'The recurring payment of matchedOccurrenceId, with its name',
  })
  matchedRecurringPayment?: StatementLineRecurringPayment;
}

@ObjectType()
export class StatementImport {
  @Field(() => ID)
  id: string;

  @Field()
  accountId: string;

  @Field(() => StatementSource)
  source: StatementSource;

  @Field(() => StatementStatus)
  status: StatementStatus;

  @Field({ nullable: true })
  parser?: string;

  @Field({ nullable: true })
  periodStart?: Date;

  @Field({ nullable: true })
  periodEnd?: Date;

  @Field({ nullable: true, description: 'Cut-off date' })
  statementDate?: Date;

  @Field({ nullable: true })
  paymentDueDate?: Date;

  @Field(() => Float, { nullable: true })
  previousBalance?: number;

  @Field(() => Float, { nullable: true })
  totalCharges?: number;

  @Field(() => Float, { nullable: true })
  totalCredits?: number;

  @Field(() => Float, { nullable: true, description: 'Balance at cut-off' })
  statementBalance?: number;

  @Field(() => Float, {
    nullable: true,
    description: '"Pago para no generar intereses"',
  })
  noInterestPayment?: number;

  @Field(() => Float, { nullable: true })
  minimumPayment?: number;

  @Field()
  currency: string;

  @Field(() => Float, {
    nullable: true,
    description: 'Previous balance plus the net of the extracted lines',
  })
  computedTotal?: number;

  @Field(() => Float, {
    nullable: true,
    description:
      'Statement balance minus computedTotal; non-zero means movements are missing or misread',
  })
  difference?: number;

  @Field({ nullable: true })
  errorMessage?: string;

  @Field({ nullable: true })
  confirmedAt?: Date;

  @Field()
  createdAt: Date;

  @Field(() => [StatementLine], { nullable: true })
  lines?: StatementLine[];
}

@ObjectType()
export class StatementImportEdge {
  @Field(() => StatementImport)
  node: StatementImport;

  @Field()
  cursor: string;
}

@ObjectType()
export class StatementImportConnection {
  @Field(() => [StatementImportEdge])
  edges: StatementImportEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

@ObjectType()
export class CardRecurringPayment {
  @Field()
  recurringExpenseId: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  occurrenceId?: string;

  @Field()
  dueDate: Date;

  @Field(() => Float)
  expectedAmount: number;

  @Field(() => OccurrenceStatus)
  status: OccurrenceStatus;
}

@ObjectType({
  description:
    "A card's month: what the statement asks to pay versus the recurring charges expected on it.",
})
export class CardMonthSummary {
  @Field()
  accountId: string;

  @Field(() => Int)
  year: number;

  @Field(() => Int)
  month: number;

  @Field(() => StatementImport, {
    nullable: true,
    description: 'Statement whose cut-off falls in this month',
  })
  statement?: StatementImport;

  @Field()
  periodStart: Date;

  @Field()
  periodEnd: Date;

  @Field(() => [CardRecurringPayment])
  recurringPayments: CardRecurringPayment[];

  @Field(() => Float)
  recurringExpected: number;

  @Field(() => Float)
  recurringPaid: number;

  @Field(() => Int, {
    description: 'Statement charges that were not registered in the app',
  })
  newChargesCount: number;

  @Field(() => Float)
  newChargesAmount: number;
}

@InputType()
export class UpdateStatementLineInput {
  @Field(() => ImportedLineStatus, {
    nullable: true,
    description: 'Only pending or ignored can be set by hand',
  })
  @IsOptional()
  @IsEnum(ImportedLineStatus)
  status?: ImportedLineStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Field({
    nullable: true,
    description: 'Link to an existing transaction (null to unlink)',
  })
  @IsOptional()
  @IsString()
  matchedTransactionId?: string;

  @Field({
    nullable: true,
    description: 'Link to a recurring payment (null to unlink)',
  })
  @IsOptional()
  @IsString()
  matchedOccurrenceId?: string;
}

@ArgsType()
export class StatementImportsArgs {
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

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  accountId?: string;
}

@ArgsType()
export class CardMonthSummaryArgs {
  @Field()
  @IsString()
  accountId: string;

  @Field(() => Int)
  @IsInt()
  @Min(2000)
  year: number;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}
