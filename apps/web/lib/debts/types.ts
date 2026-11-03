/**
 * Shapes of the debts API (feature 6) and the GraphQL field selections that
 * fetch them. Debts carry no currency: the app's home currency is assumed.
 */
export type DebtKind = 'loan' | 'card' | 'other';

export const DEBT_KINDS = [
  'loan',
  'card',
  'other',
] as const satisfies ReadonlyArray<DebtKind>;

/** Only for kind = loan; null on cards, other debts and older loans. */
export type LoanType = 'institutional' | 'personal' | 'purchase_financing';

export const LOAN_TYPES = [
  'institutional',
  'personal',
  'purchase_financing',
] as const satisfies ReadonlyArray<LoanType>;

/** Which value gives the amount to repay. */
export type LoanInterestMode = 'rate' | 'total_amount' | 'installment_amount';

export const LOAN_INTEREST_MODES = [
  'rate',
  'total_amount',
  'installment_amount',
] as const satisfies ReadonlyArray<LoanInterestMode>;

/** How often loans are paid (the recurring frequencies loans use). */
export type LoanFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export const LOAN_FREQUENCIES = [
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
] as const satisfies ReadonlyArray<LoanFrequency>;

/** Where the borrowed money went. */
export type DebtDestination = 'deposit' | 'purchase';

/** How someone lent the money (personal loans). */
export type LendingMethod =
  | 'cash'
  | 'transfer'
  | 'credit_card'
  | 'debit_card'
  | 'other';

export const LENDING_METHODS = [
  'cash',
  'transfer',
  'credit_card',
  'debit_card',
  'other',
] as const satisfies ReadonlyArray<LendingMethod>;

/**
 * Where money lent this way usually goes: with the lender's card you
 * bought something (no movement in your accounts); cash or a transfer
 * reached one of your accounts.
 */
export function destinationOfMethod(method: LendingMethod): DebtDestination {
  return method === 'credit_card' || method === 'debit_card'
    ? 'purchase'
    : 'deposit';
}

export interface ApiDebtPayment {
  id: string;
  /** Null for payments made before the debt was registered. */
  transactionId: string | null;
  isHistorical: boolean;
  amount: number;
  date: string;
}

export interface ApiDebtCharge {
  id: string;
  date: string;
  description: string | null;
  principal: number;
  totalToRepay: number;
  installments: number | null;
  destination: DebtDestination;
  transactionId: string | null;
  /** Deposited money: the account that received it. */
  depositAccountId: string | null;
  depositCountsAsIncome: boolean | null;
  /** What this money was for (informative). */
  purposeCategoryId: string | null;
  lendingMethod: LendingMethod | null;
}

export interface ApiDebt {
  id: string;
  name: string;
  kind: DebtKind;
  /** What was borrowed (or owed when it was registered). */
  principal: number;
  /** Percent a year. */
  interestRateAnnual: number | null;
  minPaymentAmount: number | null;
  startDate: string | null;
  dueDate: string | null;
  linkedAccountId: string | null;
  loanType: LoanType | null;
  status: 'active' | 'paid_off';
  lenderName: string | null;
  /** Personal loans: the contact who lent it. */
  lenderContactId: string | null;
  /** Personal loans: how the initial amount was lent. */
  lendingMethod: LendingMethod | null;
  paymentFrequency: LoanFrequency | null;
  installmentsTotal: number | null;
  installmentsPaid: number;
  installmentAmount: number | null;
  /** Principal + interest of the initial amount; null = the principal. */
  totalToRepay: number | null;
  interestMode: LoanInterestMode | null;
  includesVat: boolean;
  /** Opening fee (comisión por apertura), taken from the deposit. */
  openingFee: number | null;
  /** Fixed fee with every payment (administración, seguro), VAT included. */
  periodicFee: number | null;
  destination: DebtDestination | null;
  /** What the borrowed money was for (informative; the expense is the payments). */
  purposeCategoryId: string | null;
  nextPaymentDate: string | null;
  recurringExpenseId: string | null;
  /** Initial total + charges − every payment, never negative. */
  remainingBalance: number;
  totalPaid: number;
  /** Paid before the debt was registered (outside income/expense totals). */
  historicalPaid: number;
  /** Everything owed over time: initial total + charges. */
  totalOwed: number;
  /** What it asks for each month. */
  monthlyPayment: number | null;
  createdAt: string;
}

export const DEBT_FIELDS =
  'id name kind principal interestRateAnnual minPaymentAmount startDate dueDate linkedAccountId loanType status lenderName lenderContactId lendingMethod paymentFrequency installmentsTotal installmentsPaid installmentAmount totalToRepay interestMode includesVat openingFee periodicFee destination purposeCategoryId nextPaymentDate recurringExpenseId remainingBalance totalPaid historicalPaid totalOwed monthlyPayment createdAt';

/** A debt with its payments and charges (the loan's page). */
export interface ApiDebtDetail extends ApiDebt {
  payments: ApiDebtPayment[];
  charges: ApiDebtCharge[];
}

export const DEBT_DETAIL_FIELDS = `${DEBT_FIELDS} payments { id transactionId isHistorical amount date } charges { id date description principal totalToRepay installments destination transactionId depositAccountId depositCountsAsIncome purposeCategoryId lendingMethod }`;

export type ScheduleStatus = 'upcoming' | 'paid' | 'skipped' | 'missed';

/** One payment of a loan over time. */
export interface ApiLoanScheduleItem {
  dueDate: string;
  amount: number;
  status: ScheduleStatus;
  /** Null for projected payments (not generated yet) and unscheduled ones. */
  occurrenceId: string | null;
  transactionId: string | null;
  isHistorical: boolean;
  projected: boolean;
  /** Loans by rate: what the payment repays of the principal. */
  principal: number | null;
  /** Loans by rate: interest of the period, VAT excluded. */
  interest: number | null;
  vat: number | null;
  /** Fixed fee of the payment, VAT included. */
  fee: number | null;
  /** Left after the payment (principal for loans by rate). */
  balance: number;
  /** Loans scheduled by their charges: the installment of each charge. */
  installments: ApiLoanScheduleInstallment[] | null;
}

/** Installment `number` of `of` of one charge, inside a payment. */
export interface ApiLoanScheduleInstallment {
  number: number;
  of: number;
  amount: number;
  description: string | null;
}

export const LOAN_SCHEDULE_FIELDS =
  'dueDate amount status occurrenceId transactionId isHistorical projected principal interest vat fee balance installments { number of amount description }';

export type CandidateReason = 'history' | 'text' | 'amount' | 'ai';

/** A bank movement that looks like an open payment of the loan. */
export interface ApiLoanPaymentCandidate {
  occurrenceId: string;
  dueDate: string;
  expectedAmount: number;
  transactionId: string;
  date: string;
  amount: number;
  description: string;
  accountName: string;
  reason: CandidateReason;
  score: number;
}

export const LOAN_CANDIDATE_FIELDS =
  'occurrenceId dueDate expectedAmount transactionId date amount description accountName reason score';

/** A loan prefilled from a recurring suggestion (lender and type by AI). */
export interface ApiLoanDraft {
  fingerprint: string;
  name: string;
  lenderName: string;
  loanType: LoanType;
  paymentFrequency: string;
  interval: number;
  installmentAmount: number;
  currency: string;
  firstPaymentDate: string;
  lastPaymentDate: string;
  paymentsDetected: number;
  paymentAccountId: string | null;
  categoryId: string | null;
  merchantPattern: string;
  classifiedBy: string | null;
}

export const LOAN_DRAFT_FIELDS =
  'fingerprint name lenderName loanType paymentFrequency interval installmentAmount currency firstPaymentDate lastPaymentDate paymentsDetected paymentAccountId categoryId merchantPattern classifiedBy';

export type PayoffStrategy = 'avalanche' | 'snowball';

/** One debt in a payoff plan, in the plan's order. */
export interface ApiPayoffProjection {
  debtId: string;
  debtName: string;
  currentBalance: number;
  /** What it gets once it is the priority (minimum + extra + freed minimums). */
  monthlyPayment: number;
  payoffDate: string;
  totalInterest: number;
  /** Null when the payments never pay it off. */
  monthsToPayoff: number | null;
}

export const PAYOFF_FIELDS =
  'debtId debtName currentBalance monthlyPayment payoffDate totalInterest monthsToPayoff';

/** Chart categories: loan types, cards, other debts and card MSI plans. */
export type DebtCategory =
  | 'institutional'
  | 'personal'
  | 'purchase_financing'
  | 'card'
  | 'other'
  | 'msi';

/** Fixed order of the categories (and of their chart colors). */
export const DEBT_CATEGORIES = [
  'institutional',
  'personal',
  'purchase_financing',
  'card',
  'other',
  'msi',
] as const satisfies ReadonlyArray<DebtCategory>;

export interface ApiDebtUpcoming {
  days30: number;
  days60: number;
  days90: number;
}

export interface ApiMsiPlan {
  id: string;
  name: string;
  accountName: string | null;
  installmentAmount: number;
  installmentsTotal: number;
  installmentsPaid: number;
  remaining: number;
  nextDueDate: string | null;
}

/** Figures for the debts charts; MSI plans always come apart. */
export interface ApiDebtInsights {
  byType: {
    type: DebtCategory;
    remaining: number;
    totalOwed: number;
    paid: number;
    count: number;
  }[];
  paidByMonth: {
    month: string;
    counted: number;
    historical: number;
    msi: number;
  }[];
  projection: { month: string; debt: number; msi: number }[];
  upcoming: ApiDebtUpcoming;
  upcomingMsi: ApiDebtUpcoming;
  monthlyPayments: number;
  msiMonthlyPayments: number;
  averageMonthlyIncome: number;
  msi: ApiMsiPlan[];
}

const UPCOMING = 'days30 days60 days90';

export const DEBT_INSIGHTS_FIELDS = `byType { type remaining totalOwed paid count } paidByMonth { month counted historical msi } projection { month debt msi } upcoming { ${UPCOMING} } upcomingMsi { ${UPCOMING} } monthlyPayments msiMonthlyPayments averageMonthlyIncome msi { id name accountName installmentAmount installmentsTotal installmentsPaid remaining nextDueDate }`;
