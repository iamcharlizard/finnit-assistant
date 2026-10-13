/**
 * Card statements (feature 13) as the Finnit API returns them: an import
 * (one uploaded PDF) and its extracted lines.
 */
export const STATEMENT_STATUSES = [
  'uploaded',
  'processing',
  'needs_review',
  'confirmed',
  'failed',
] as const;
export type StatementStatus = (typeof STATEMENT_STATUSES)[number];

export const LINE_KINDS = [
  'charge',
  'payment',
  'refund',
  'fee',
  'interest',
  'installment',
  'deposit',
] as const;
export type LineKind = (typeof LINE_KINDS)[number];

export type LineStatus = 'pending' | 'matched' | 'created' | 'ignored';

export interface ApiStatementLine {
  id: string;
  date: string;
  postDate: string | null;
  description: string | null;
  merchant: string | null;
  /** Positive; `kind` gives the direction. */
  amount: number;
  currency: string;
  kind: LineKind;
  status: LineStatus;
  installmentNumber: number | null;
  installmentTotal: number | null;
  /** The category the line gets when it becomes a movement. */
  suggestedCategoryId: string | null;
  matchedTransactionId: string | null;
  matchedOccurrenceId: string | null;
  matchedRecurringPayment: {
    occurrenceId: string;
    recurringExpenseId: string;
    name: string;
    dueDate: string;
  } | null;
}

export const STATEMENT_LINE_FIELDS =
  'id date postDate description merchant amount currency kind status installmentNumber installmentTotal suggestedCategoryId matchedTransactionId matchedOccurrenceId matchedRecurringPayment { occurrenceId recurringExpenseId name dueDate }';

export interface ApiStatementImport {
  id: string;
  accountId: string;
  source: 'pdf' | 'belvo';
  status: StatementStatus;
  /** "banamex_v1", "ai:<provider>/<model>"… */
  parser: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  statementDate: string | null;
  paymentDueDate: string | null;
  previousBalance: number | null;
  totalCharges: number | null;
  totalCredits: number | null;
  statementBalance: number | null;
  noInterestPayment: number | null;
  minimumPayment: number | null;
  currency: string;
  computedTotal: number | null;
  /** statementBalance − computedTotal; not 0 means lines are missing or misread. */
  difference: number | null;
  errorMessage: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

export const STATEMENT_IMPORT_FIELDS =
  'id accountId source status parser periodStart periodEnd statementDate paymentDueDate previousBalance totalCharges totalCredits statementBalance noInterestPayment minimumPayment currency computedTotal difference errorMessage confirmedAt createdAt';

export interface ApiStatementDetail extends ApiStatementImport {
  lines: ApiStatementLine[] | null;
}

export const STATEMENT_DETAIL_FIELDS = `${STATEMENT_IMPORT_FIELDS} lines { ${STATEMENT_LINE_FIELDS} }`;

/** An account as the statements screens need it. */
export interface StatementAccount {
  id: string;
  name: string;
  type: string;
  currency: string;
  archived: boolean;
  metadata: {
    nickname?: string | null;
    bank?: string | null;
    last4?: string | null;
  } | null;
}

export const STATEMENT_ACCOUNT_FIELDS =
  'id name type currency archived metadata { nickname bank last4 }';

/** A category for the line picker (key orders the income group). */
export interface StatementCategory {
  id: string;
  name: string;
  parentId: string | null;
  key: string | null;
}
