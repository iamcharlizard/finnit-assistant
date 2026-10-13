/**
 * Shapes of the Finnit API data the finance screens read, and the GraphQL
 * field selections that fetch them.
 */
export type AccountType = 'cash' | 'credit' | 'debit' | 'ewallet' | 'savings';

export interface ApiAccount {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  /** Credit cards: negative is what is owed. */
  balanceCurrent: number;
  archived: boolean;
  metadata: {
    bank: string | null;
    last4: string | null;
    creditLimit: number | null;
    /** The user's name for the account (feature 18). */
    nickname?: string | null;
    /** Card colors chosen by the user, '#RRGGBB'. */
    design?: AccountDesign | null;
  } | null;
  creditCardTerms: {
    statementDay: number;
    paymentDueDay: number;
    interestRateAnnual?: number | null;
  } | null;
}

export interface AccountDesign {
  primaryColor: string;
  secondaryColor?: string | null;
}

export const ACCOUNT_FIELDS =
  'id name type currency balanceCurrent archived metadata { bank last4 creditLimit nickname design { primaryColor secondaryColor } } creditCardTerms { statementDay paymentDueDay interestRateAnnual }';

export type TransactionType = 'income' | 'expense' | 'transfer' | 'adjustment';

export interface ApiTransaction {
  id: string;
  type: TransactionType;
  /** Always positive; `type` gives the direction. */
  amount: number;
  currency: string;
  txnDate: string;
  description: string | null;
  merchantName: string | null;
  isPending: boolean;
  source: string;
  /** Transfers only: 'out' on the source account, 'in' on the destination. */
  transferDirection?: 'in' | 'out' | null;
  accountId: string;
  account: {
    id: string;
    name: string;
    type: AccountType;
    metadata?: { nickname?: string | null } | null;
  } | null;
  category: { id: string; name: string; parentId: string | null } | null;
}

export const TRANSACTION_FIELDS =
  'id type amount currency txnDate description merchantName isPending source transferDirection accountId account { id name type metadata { nickname } } category { id name parentId }';

export interface ApiCategory {
  id: string;
  name: string;
  parentId: string | null;
}

export const CATEGORY_FIELDS = 'id name parentId';

export interface Connection<T> {
  totalCount: number;
  edges: { node: T }[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
}

export type RecurringKind =
  | 'housing'
  | 'installment'
  | 'insurance'
  | 'loan'
  | 'membership'
  | 'other'
  | 'subscription'
  | 'utility';

export type OccurrenceStatus = 'upcoming' | 'paid' | 'skipped' | 'missed';

export interface ApiUpcomingPayment {
  dueDate: string;
  expectedAmount: number;
  occurrenceId: string | null;
  /** Null for reminder-only expenses. */
  status: OccurrenceStatus | null;
  recurringExpense: {
    id: string;
    name: string;
    kind: RecurringKind;
    currency: string;
    accountId: string | null;
    isVariableAmount: boolean;
  };
}

export const UPCOMING_PAYMENT_FIELDS =
  'dueDate expectedAmount occurrenceId status recurringExpense { id name kind currency accountId isVariableAmount }';

export interface ApiMonthlyReport {
  year: number;
  month: number;
  currency: string;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  categoryBreakdown: {
    categoryId: string;
    categoryName: string;
    amount: number;
  }[];
}

export const MONTHLY_REPORT_FIELDS =
  'year month currency totalIncome totalExpenses netIncome categoryBreakdown { categoryId categoryName amount }';
