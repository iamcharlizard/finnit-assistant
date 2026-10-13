import { ImportedLineKind } from '@finnit/database';

/** One movement of a card statement. Amounts are positive; `kind` gives the direction. */
export interface ParsedStatementLine {
  /** Operation date, YYYY-MM-DD. */
  date: string;
  /** Posting date, YYYY-MM-DD, when the statement shows it. */
  postDate?: string;
  description: string;
  merchant?: string;
  amount: number;
  kind: ImportedLineKind;
  /** "Meses sin intereses": this charge is installment N of `installmentTotal`. */
  installmentNumber?: number;
  installmentTotal?: number;
}

export interface ParsedStatement {
  currency: string;
  /** Last 4 digits of the card, used to warn when the file belongs to another card. */
  cardLast4?: string;
  periodStart?: string;
  periodEnd?: string;
  /** Cut-off date ("fecha de corte"). */
  statementDate?: string;
  /** Payment due date ("fecha límite de pago"). */
  paymentDueDate?: string;
  previousBalance?: number;
  totalCharges?: number;
  totalCredits?: number;
  /** Balance at cut-off ("saldo al corte" / "saldo deudor total"). */
  statementBalance?: number;
  /** "Pago para no generar intereses". */
  noInterestPayment?: number;
  minimumPayment?: number;
  lines: ParsedStatementLine[];
}

/** Kinds that increase what the cardholder owes. */
export const DEBIT_KINDS: ReadonlySet<ImportedLineKind> = new Set([
  ImportedLineKind.charge,
  ImportedLineKind.fee,
  ImportedLineKind.interest,
  ImportedLineKind.installment,
]);

export interface StatementParser {
  /** Stored in StatementImport.parser. */
  readonly id: string;
  /** Cheap check on the extracted text; parsers that need the raw PDF return true. */
  canParse(text: string): boolean;
  parse(input: { text: string; pdf: Buffer }): Promise<ParsedStatement>;
}

export class StatementParseError extends Error {}
