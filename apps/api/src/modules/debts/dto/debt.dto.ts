import {
  ObjectType,
  Field,
  InputType,
  ArgsType,
  ID,
  Float,
  Int,
  registerEnumType,
  PartialType,
  OmitType,
} from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsPositive,
  IsInt,
  IsBoolean,
  IsEnum,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import {
  DebtChargeDestination,
  LendingMethod,
  DebtKind,
  DebtStatus,
  OccurrenceStatus,
  LoanInterestMode,
  LoanType,
  RecurringFrequency,
  RecurringTrackingMode,
} from '@finnit/database';
import { PageInfo } from '../../../common/types/pagination.types';
// Registers RecurringFrequency and RecurringTrackingMode with GraphQL.
import '../../recurring-expenses/dto/recurring-expense.dto';

/** Annual rates of buy-now-pay-later and payday loans go far beyond 100%. */
export const MAX_ANNUAL_RATE = 1000;

registerEnumType(DebtKind, {
  name: 'DebtKind',
});
registerEnumType(LoanType, {
  name: 'LoanType',
  description:
    'institutional: bank or lending company, fixed payments; personal: family or friends, flexible and may grow; purchase_financing: Kueski / Didi, each purchase adds installments on the same due dates',
});
registerEnumType(LoanInterestMode, {
  name: 'LoanInterestMode',
  description:
    'Which value defines the amount to repay: rate (principal + annual rate, French amortization), total_amount or installment_amount',
});
registerEnumType(DebtStatus, { name: 'DebtStatus' });
registerEnumType(LendingMethod, {
  name: 'LendingMethod',
  description:
    'How someone lent the money: cash, transfer, their credit or debit card, other',
});

registerEnumType(DebtChargeDestination, {
  name: 'DebtChargeDestination',
  description:
    'deposit: the money went into an account; purchase: it paid for something directly',
});

@ObjectType()
export class Debt {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  name: string;

  @Field({
    nullable: true,
    description:
      'Loans: what the first amount was (first purchase, what it was lent for)',
  })
  description?: string;

  @Field(() => DebtKind)
  kind: DebtKind;

  @Field(() => Float)
  principal: number;

  @Field(() => Float, { nullable: true })
  interestRateAnnual?: number;

  @Field(() => Float, { nullable: true })
  minPaymentAmount?: number;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field({ nullable: true })
  linkedAccountId?: string;

  @Field(() => LoanType, { nullable: true })
  loanType?: LoanType;

  @Field(() => DebtStatus)
  status: DebtStatus;

  @Field({ nullable: true })
  lenderName?: string;

  @Field({
    nullable: true,
    description: 'Personal loans: the contact who lent it',
  })
  lenderContactId?: string;

  @Field(() => RecurringFrequency, { nullable: true })
  paymentFrequency?: RecurringFrequency;

  @Field(() => Int, { nullable: true })
  installmentsTotal?: number;

  @Field(() => Int, {
    description: 'Payments made so far, historical ones included',
  })
  installmentsPaid: number;

  @Field(() => Float, { nullable: true })
  installmentAmount?: number;

  @Field(() => Float, {
    nullable: true,
    description: 'Principal + interest of the initial amount',
  })
  totalToRepay?: number;

  @Field(() => LoanInterestMode, { nullable: true })
  interestMode?: LoanInterestMode;

  @Field()
  includesVat: boolean;

  @Field(() => Float, {
    nullable: true,
    description:
      'Opening fee (comisión por apertura), taken from the money deposited',
  })
  openingFee?: number;

  @Field(() => Float, {
    nullable: true,
    description:
      'Fixed fee charged with every payment (administración, seguro), VAT included',
  })
  periodicFee?: number;

  @Field(() => DebtChargeDestination, { nullable: true })
  destination?: DebtChargeDestination;

  @Field({ nullable: true })
  disbursementTransactionId?: string;

  @Field({
    description:
      'destination = deposit: the money was added to an account balance (false = already spent, only the debt was recorded)',
  })
  depositAddsToBalance: boolean;

  @Field({
    nullable: true,
    description:
      'What the borrowed money was for (informative; the expense is the payments)',
  })
  purposeCategoryId?: string;

  @Field(() => LendingMethod, {
    nullable: true,
    description: 'Personal loans: how it was lent',
  })
  lendingMethod?: LendingMethod;

  @Field({
    nullable: true,
    description: 'Recurring expense that schedules the payments',
  })
  recurringExpenseId?: string;

  @Field({ nullable: true })
  nextPaymentDate?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Computed fields
  @Field(() => Float)
  remainingBalance: number;

  @Field(() => Float)
  totalPaid: number;

  @Field(() => Float, {
    description: 'Paid before the debt was registered (outside totals)',
  })
  historicalPaid: number;

  @Field(() => Float, {
    description: 'Everything owed over time: initial total + charges',
  })
  totalOwed: number;

  @Field(() => Float, { nullable: true })
  monthlyPayment?: number;

  @Field(() => [DebtPayment], { description: 'Newest first' })
  payments: DebtPayment[];

  @Field(() => [DebtCharge], { description: 'Newest first' })
  charges: DebtCharge[];
}

@ObjectType({ description: 'Money added to a debt after it was registered' })
export class DebtCharge {
  @Field(() => ID)
  id: string;

  @Field()
  debtId: string;

  @Field()
  date: Date;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  principal: number;

  @Field(() => Float)
  totalToRepay: number;

  @Field(() => Int, { nullable: true })
  installments?: number;

  @Field(() => Int, {
    description: 'Installments paid before it was registered',
  })
  installmentsPaid: number;

  @Field({
    nullable: true,
    description:
      'First due date of its installments; null = the first after its date',
  })
  firstPaymentDate?: Date;

  @Field(() => LoanInterestMode, {
    nullable: true,
    description: 'How its interest was given (with installments)',
  })
  interestMode?: LoanInterestMode;

  @Field(() => Float, { nullable: true, description: 'Rate mode: annual %' })
  interestRateAnnual?: number;

  @Field({ description: 'Rate mode: 16% VAT on the interest' })
  includesVat: boolean;

  @Field(() => DebtChargeDestination)
  destination: DebtChargeDestination;

  @Field({ nullable: true })
  transactionId?: string;

  @Field({
    nullable: true,
    description: 'Deposited money: the account that received it',
  })
  depositAccountId?: string;

  @Field({
    nullable: true,
    description: 'Deposited money: whether it counts as income',
  })
  depositCountsAsIncome?: boolean;

  @Field({
    description:
      'destination = deposit: added to an account balance (false = already spent)',
  })
  depositAddsToBalance: boolean;

  @Field({
    nullable: true,
    description: 'What this money was for (informative)',
  })
  purposeCategoryId?: string;

  @Field(() => LendingMethod, {
    nullable: true,
    description: 'Personal loans: how it was lent',
  })
  lendingMethod?: LendingMethod;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class DebtPayment {
  @Field(() => ID)
  id: string;

  @Field()
  debtId: string;

  /** Null for payments made before the debt was registered. */
  @Field(() => String, { nullable: true })
  transactionId: string | null;

  /** Made before the debt was registered; outside income/expense totals. */
  @Field()
  isHistorical: boolean;

  @Field(() => Float)
  amount: number;

  @Field()
  date: Date;
}

@ObjectType()
export class DebtSummary {
  @Field(() => Float)
  totalDebt: number;

  @Field(() => Float)
  totalPaid: number;

  @Field(() => Float)
  totalRemaining: number;

  @Field(() => Float)
  totalMonthlyPayments: number;

  @Field(() => [DebtPayoffProjection])
  payoffProjections: DebtPayoffProjection[];
}

@ObjectType()
export class DebtPayoffProjection {
  @Field()
  debtId: string;

  @Field()
  debtName: string;

  @Field(() => Float)
  currentBalance: number;

  @Field(() => Float)
  monthlyPayment: number;

  @Field()
  payoffDate: Date;

  @Field(() => Float)
  totalInterest: number;

  @Field(() => Int, {
    nullable: true,
    description:
      'Months until the debt is paid off; null when the payments never pay it off (they do not cover the interest, or the debt gets no payment)',
  })
  monthsToPayoff?: number | null;
}

@ObjectType()
export class DebtConnection {
  @Field(() => [DebtEdge])
  edges: DebtEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field()
  totalCount: number;
}

@ObjectType()
export class DebtEdge {
  @Field(() => Debt)
  node: Debt;

  @Field()
  cursor: string;
}

@InputType()
export class CreateDebtInput {
  @Field()
  @IsString()
  name: string;

  @Field({
    nullable: true,
    description:
      'Loans: what the first amount was (first purchase, what it was lent for)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @Field(() => DebtKind)
  kind: DebtKind;

  @Field(() => Float, {
    description:
      'Amount borrowed; personal loans may start at 0 and get amounts added later',
  })
  @IsNumber()
  @Min(0)
  principal: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_ANNUAL_RATE)
  interestRateAnnual?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  minPaymentAmount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  linkedAccountId?: string;

  // Loans (kind = loan) ------------------------------------------------

  @Field(() => LoanType, { nullable: true })
  @IsOptional()
  @IsEnum(LoanType)
  loanType?: LoanType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lenderName?: string;

  @Field({
    nullable: true,
    description:
      'Personal loans: the contact who lent it (default: a contact named lenderName, created if needed)',
  })
  @IsOptional()
  @IsString()
  lenderContactId?: string;

  @Field(() => RecurringFrequency, { nullable: true })
  @IsOptional()
  @IsEnum(RecurringFrequency)
  paymentFrequency?: RecurringFrequency;

  @Field(() => Int, {
    nullable: true,
    description:
      'Number of payments (institutional) or of the initial purchase (purchase financing)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  installmentsTotal?: number;

  @Field(() => LoanInterestMode, { nullable: true })
  @IsOptional()
  @IsEnum(LoanInterestMode)
  interestMode?: LoanInterestMode;

  @Field({ nullable: true, description: 'Add 16% VAT to the interest' })
  @IsOptional()
  @IsBoolean()
  includesVat?: boolean;

  @Field(() => Float, {
    nullable: true,
    description:
      'Institutional loans: opening fee (comisión por apertura, VAT included). Not an expense: the deposit is principal − fee and the whole principal is owed',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  openingFee?: number;

  @Field(() => Float, {
    nullable: true,
    description:
      'Institutional loans with a rate: fixed fee charged with every payment (administración, seguro), VAT included. Added to each payment, not to the interest',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  periodicFee?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  totalToRepay?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  installmentAmount?: number;

  @Field({
    nullable: true,
    description: 'First due date; anchors the payment schedule',
  })
  @IsOptional()
  @IsDateString()
  firstPaymentDate?: Date;

  @Field(() => Int, {
    nullable: true,
    description:
      'Scheduled payments already made before registering the loan; recorded as historical (outside totals)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  installmentsPaid?: number;

  @Field(() => [HistoricalDebtPaymentInput], {
    nullable: true,
    description:
      'Past payments of any amount (e.g. personal loans); with an account they become movements and count in totals',
  })
  @IsOptional()
  historicalPayments?: HistoricalDebtPaymentInput[];

  @Field({
    nullable: true,
    description: 'Account the payments are made from',
  })
  @IsOptional()
  @IsString()
  paymentAccountId?: string;

  @Field({
    nullable: true,
    description: 'Category of the payments; default: Loan Payments',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Field({
    nullable: true,
    description:
      'What the money was for (informative; the expense is the payments)',
  })
  @IsOptional()
  @IsString()
  purposeCategoryId?: string;

  @Field(() => LendingMethod, {
    nullable: true,
    description:
      'Personal loans: how it was lent (cash, transfer, their card…)',
  })
  @IsOptional()
  @IsEnum(LendingMethod)
  lendingMethod?: LendingMethod;

  @Field({
    nullable: true,
    description: 'Text that identifies the payments in bank movements',
  })
  @IsOptional()
  @IsString()
  merchantPattern?: string;

  @Field(() => RecurringTrackingMode, { nullable: true })
  @IsOptional()
  @IsEnum(RecurringTrackingMode)
  trackingMode?: RecurringTrackingMode;

  @Field(() => DebtChargeDestination, { nullable: true })
  @IsOptional()
  @IsEnum(DebtChargeDestination)
  destination?: DebtChargeDestination;

  @Field({
    nullable: true,
    description: 'destination = deposit: account that received the money',
  })
  @IsOptional()
  @IsString()
  depositAccountId?: string;

  @Field({
    nullable: true,
    description:
      'Count the deposit as income (default: a balance adjustment outside totals)',
  })
  @IsOptional()
  @IsBoolean()
  depositCountsAsIncome?: boolean;

  @Field({
    nullable: true,
    description:
      'destination = deposit: add the money to the account balance (default true). False for money already spent, e.g. an old loan: only the debt is recorded, without a movement',
  })
  @IsOptional()
  @IsBoolean()
  depositAddsToBalance?: boolean;
}

@InputType()
export class HistoricalDebtPaymentInput {
  @Field(() => Float)
  @IsNumber()
  @IsPositive()
  amount: number;

  @Field()
  @IsDateString()
  date: Date;

  @Field({
    nullable: true,
    description:
      'Count it in income/expense totals: creates an expense movement in this account',
  })
  @IsOptional()
  @IsString()
  accountId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

@InputType({
  description:
    'Turns a recurring suggestion into a loan; omitted fields come from recurringSuggestionLoanDraft',
})
export class AcceptSuggestionAsLoanInput extends PartialType(CreateDebtInput) {}

@InputType()
export class AddDebtChargeInput {
  @Field()
  @IsString()
  debtId: string;

  @Field()
  @IsDateString()
  date: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @Field(() => Float)
  @IsNumber()
  @IsPositive()
  principal: number;

  @Field(() => Int, {
    nullable: true,
    description:
      'Installments of this charge (required for purchase financing)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  installments?: number;

  @Field(() => Int, {
    nullable: true,
    description:
      'Installments of this charge already paid before registering it (historical payments, outside totals)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  installmentsPaid?: number;

  @Field(() => LoanInterestMode, {
    nullable: true,
    description: 'Default: total_amount (no interest unless totalToRepay)',
  })
  @IsOptional()
  @IsEnum(LoanInterestMode)
  interestMode?: LoanInterestMode;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_ANNUAL_RATE)
  interestRateAnnual?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  includesVat?: boolean;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  totalToRepay?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  installmentAmount?: number;

  @Field(() => DebtChargeDestination)
  @IsEnum(DebtChargeDestination)
  destination: DebtChargeDestination;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  depositAccountId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  depositCountsAsIncome?: boolean;

  @Field({
    nullable: true,
    description:
      'destination = deposit: add the money to the account balance (default true). False for money already spent, e.g. an old loan: only the debt is recorded, without a movement',
  })
  @IsOptional()
  @IsBoolean()
  depositAddsToBalance?: boolean;

  @Field({
    nullable: true,
    description:
      'What the money was for (informative; the expense is the payments)',
  })
  @IsOptional()
  @IsString()
  purposeCategoryId?: string;

  @Field(() => LendingMethod, {
    nullable: true,
    description:
      'Personal loans: how it was lent (cash, transfer, their card…)',
  })
  @IsOptional()
  @IsEnum(LendingMethod)
  lendingMethod?: LendingMethod;

  @Field({
    nullable: true,
    description:
      'With installments: when the first one is due (may skip due dates of the loan). Default: the first due date after the charge; for a personal loan without a schedule, a month after it',
  })
  @IsOptional()
  @IsDateString()
  firstPaymentDate?: Date;
}

@InputType({
  description:
    'Edits money added to a loan: the same fields as when it was added',
})
export class UpdateDebtChargeInput extends OmitType(
  AddDebtChargeInput,
  ['debtId'] as const,
  InputType,
) {}

@InputType({
  description:
    'A new payment made from an account: creates the expense movement and links it to the loan (and its next scheduled payment)',
})
export class RecordDebtPaymentInput {
  @Field()
  @IsString()
  debtId: string;

  @Field()
  @IsString()
  accountId: string;

  @Field(() => Float)
  @IsNumber()
  @IsPositive()
  amount: number;

  @Field()
  @IsDateString()
  date: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Field({
    nullable: true,
    description: 'Scheduled payment it pays; default: the oldest open one',
  })
  @IsOptional()
  @IsString()
  occurrenceId?: string;
}

@InputType()
export class UpdateDebtInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => DebtKind, { nullable: true })
  @IsOptional()
  kind?: DebtKind;

  @Field(() => Float, {
    nullable: true,
    description: 'Cannot be less than what has been paid already',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  principal?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_ANNUAL_RATE)
  interestRateAnnual?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  minPaymentAmount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  linkedAccountId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lenderName?: string;

  @Field(() => String, {
    nullable: true,
    description: 'What the money was for; null or "" clears it',
  })
  @IsOptional()
  @IsString()
  purposeCategoryId?: string | null;
}

@InputType({
  description:
    'Edits a loan; omitted fields stay. Changing the amount, the number of payments or the fees recomputes its terms and reprices its open scheduled payments',
})
export class UpdateLoanInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @Field(() => String, {
    nullable: true,
    description: 'What the first amount was; "" or null clears it',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string | null;

  @Field(() => String, { nullable: true, description: '"" or null clears it' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lenderName?: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      'Personal loans: the contact who lent it; null clears it. Its name becomes lenderName',
  })
  @IsOptional()
  @IsString()
  lenderContactId?: string | null;

  @Field(() => LendingMethod, {
    nullable: true,
    description: 'Personal loans: how it was lent; null clears it',
  })
  @IsOptional()
  @IsEnum(LendingMethod)
  lendingMethod?: LendingMethod | null;

  @Field(() => Float, {
    nullable: true,
    description: 'Amount borrowed; personal loans may be 0',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  principal?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Fixed-term loans: number of payments',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  installmentsTotal?: number;

  @Field(() => Date, {
    nullable: true,
    description: 'Date of the loan; null clears it (it may be unknown)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: Date | null;

  @Field(() => Float, {
    nullable: true,
    description:
      'Bank or lender loans: opening fee, VAT included; 0 removes it. The deposit follows it',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  openingFee?: number;

  @Field(() => Float, {
    nullable: true,
    description:
      'Bank or lender loans by rate: fixed fee per payment, VAT included; 0 removes it',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  periodicFee?: number;

  @Field(() => String, {
    nullable: true,
    description: 'What the money was for; null or "" clears it',
  })
  @IsOptional()
  @IsString()
  purposeCategoryId?: string | null;

  @Field({
    nullable: true,
    description:
      'False removes the deposit of the loan money from its account (and takes it off the balance): the money was already spent. True leaves it as it is',
  })
  @IsOptional()
  @IsBoolean()
  depositAddsToBalance?: boolean;
}

@InputType()
export class CreateDebtPaymentInput {
  @Field()
  @IsString()
  debtId: string;

  @Field({
    nullable: true,
    description: 'The movement that paid it; omit only for historical payments',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @Field({
    nullable: true,
    description:
      'Made before the debt was registered: lowers the balance, outside totals',
  })
  @IsOptional()
  @IsBoolean()
  isHistorical?: boolean;

  @Field(() => Float)
  @IsNumber()
  @IsPositive()
  amount: number;

  @Field()
  @IsDateString()
  date: Date;
}

@ArgsType()
export class DebtsArgs {
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

  @Field(() => DebtKind, { nullable: true })
  @IsOptional()
  kind?: DebtKind;

  @Field({ nullable: true })
  @IsOptional()
  includePayoffProjections?: boolean;
}

@InputType()
export class PayoffStrategyInput {
  @Field(() => [String])
  debtIds: string[];

  @Field(() => Float, { description: 'Extra paid each month; 0 or more' })
  @IsNumber()
  @Min(0)
  extraPayment: number;

  @Field()
  strategy: 'avalanche' | 'snowball'; // avalanche: highest interest first, snowball: lowest balance first
}

@ObjectType({
  description: 'One installment of one charge inside a scheduled payment',
})
export class LoanScheduleInstallment {
  @Field(() => Int, {
    description: 'Which installment of the charge (1-based)',
  })
  number: number;

  @Field(() => Int, { description: 'Installments of the charge' })
  of: number;

  @Field(() => Float)
  amount: number;

  @Field({ nullable: true, description: 'What was bought or lent' })
  description?: string;
}

@ObjectType({ description: 'One payment of a loan over time' })
export class LoanScheduleItem {
  @Field()
  dueDate: Date;

  @Field(() => Float)
  amount: number;

  @Field(() => OccurrenceStatus, {
    description: 'Projected payments are upcoming',
  })
  status: OccurrenceStatus;

  @Field(() => ID, {
    nullable: true,
    description: 'Scheduled payment; null for projected or unscheduled ones',
  })
  occurrenceId?: string;

  @Field(() => ID, { nullable: true })
  transactionId?: string;

  @Field({ description: 'Paid before the loan was registered' })
  isHistorical: boolean;

  @Field({ description: 'Not generated yet: from the terms and the balance' })
  projected: boolean;

  @Field({
    nullable: true,
    description: 'Moved by the user: the date the schedule gave it',
  })
  originalDueDate?: Date;

  @Field(() => Float, {
    nullable: true,
    description: 'Loans by rate: principal repaid by this payment',
  })
  principal?: number;

  @Field(() => Float, {
    nullable: true,
    description: 'Loans by rate: interest of the period, VAT excluded',
  })
  interest?: number;

  @Field(() => Float, {
    nullable: true,
    description: 'Loans by rate: VAT on the interest',
  })
  vat?: number;

  @Field(() => Float, {
    nullable: true,
    description: 'Fixed fee of this payment, VAT included',
  })
  fee?: number;

  @Field(() => [LoanScheduleInstallment], {
    nullable: true,
    description:
      'Loans scheduled by their charges: the installment of each charge this payment covers',
  })
  installments?: LoanScheduleInstallment[];

  @Field(() => Float, {
    description:
      'Left after this payment: principal for loans by rate, else everything owed',
  })
  balance: number;
}

@ObjectType({
  description: 'A bank movement that looks like an open payment of a loan',
})
export class LoanPaymentCandidate {
  @Field(() => ID)
  occurrenceId: string;

  @Field()
  dueDate: Date;

  @Field(() => Float)
  expectedAmount: number;

  @Field(() => ID)
  transactionId: string;

  @Field()
  date: Date;

  @Field(() => Float)
  amount: number;

  @Field()
  description: string;

  @Field()
  accountName: string;

  @Field({
    description:
      'history (same merchant as earlier payments), text (names the lender), amount (amount and date only) or ai (picked by AI among similar ones)',
  })
  reason: string;

  @Field(() => Float, { description: '0..1' })
  score: number;
}

@ArgsType()
export class DebtInsightsArgs {
  @Field(() => Int, {
    nullable: true,
    description: 'Months of payment history, this one included (default 12)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  months?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Months of balance projection (default 24)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  horizon?: number;

  @Field({
    nullable: true,
    description: 'Only loans (no cards, other debts or card MSI plans)',
  })
  @IsOptional()
  @IsBoolean()
  loansOnly?: boolean;
}

@ObjectType()
export class DebtTypeTotal {
  @Field({
    description:
      'institutional, personal, purchase_financing, card, other or msi (card installment plans)',
  })
  type: string;

  @Field(() => Float)
  remaining: number;

  @Field(() => Float)
  totalOwed: number;

  @Field(() => Float)
  paid: number;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class DebtPaidMonth {
  @Field({ description: 'YYYY-MM' })
  month: string;

  @Field(() => Float, {
    description: 'Payments that are movements (in totals)',
  })
  counted: number;

  @Field(() => Float, { description: 'Paid before registering the debt' })
  historical: number;

  @Field(() => Float, { description: 'Card MSI installments paid' })
  msi: number;
}

@ObjectType()
export class DebtProjectedMonth {
  @Field({ description: 'YYYY-MM; balance at the end of the month' })
  month: string;

  @Field(() => Float)
  debt: number;

  @Field(() => Float)
  msi: number;
}

@ObjectType()
export class DebtUpcomingTotals {
  @Field(() => Float)
  days30: number;

  @Field(() => Float)
  days60: number;

  @Field(() => Float)
  days90: number;
}

@ObjectType({ description: 'A card purchase in interest-free installments' })
export class MsiPlan {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  accountName?: string;

  @Field(() => Float)
  installmentAmount: number;

  @Field(() => Int)
  installmentsTotal: number;

  @Field(() => Int)
  installmentsPaid: number;

  @Field(() => Float)
  remaining: number;

  @Field({ nullable: true })
  nextDueDate?: Date;
}

@ObjectType({
  description:
    'Figures for the debts charts; card MSI plans are always reported apart',
})
export class DebtInsights {
  @Field(() => [DebtTypeTotal])
  byType: DebtTypeTotal[];

  @Field(() => [DebtPaidMonth], { description: 'Oldest first' })
  paidByMonth: DebtPaidMonth[];

  @Field(() => [DebtProjectedMonth])
  projection: DebtProjectedMonth[];

  @Field(() => DebtUpcomingTotals)
  upcoming: DebtUpcomingTotals;

  @Field(() => DebtUpcomingTotals)
  upcomingMsi: DebtUpcomingTotals;

  @Field(() => Float)
  monthlyPayments: number;

  @Field(() => Float)
  msiMonthlyPayments: number;

  @Field(() => Float, {
    description: 'Average income of the last 3 full months',
  })
  averageMonthlyIncome: number;

  @Field(() => [MsiPlan])
  msi: MsiPlan[];
}
