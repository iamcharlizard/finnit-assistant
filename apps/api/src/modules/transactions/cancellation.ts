/**
 * Before marking a card movement cancelled: what its confirmed statement
 * says. A cancelled charge either never reaches the statement, or reaches
 * it together with its reversal (a credit of the same amount); a charge on
 * the statement without a reversal is still owed, and cancelling it would
 * make what the card owes in Finnit differ from the bank's.
 */

const AMOUNT_TOLERANCE = 0.01;

export interface StatementForCheck {
  /** Cut-off date (YYYY-MM-DD), or the period's end. */
  closedOn: string;
  lines: ReadonlyArray<{
    matchedTransactionId: string | null;
    /** Money in (a refund or payment) vs a charge. */
    credit: boolean;
    amount: number;
  }>;
}

export interface CancellationCheckResult {
  /** The statement's cut-off (YYYY-MM-DD); null without a statement. */
  statementDate: string | null;
  /** On that statement; null without one. */
  appears: boolean | null;
  /** A credit of the same amount on that statement (its reversal). */
  reversalFound: boolean;
}

export function checkCancellation(
  movement: { id: string; amount: number },
  statement: StatementForCheck | null,
): CancellationCheckResult {
  if (!statement) {
    return { statementDate: null, appears: null, reversalFound: false };
  }
  const appears = statement.lines.some(
    (line) => line.matchedTransactionId === movement.id,
  );
  const reversalFound = statement.lines.some(
    (line) =>
      line.credit &&
      line.matchedTransactionId !== movement.id &&
      Math.abs(Math.abs(line.amount) - Math.abs(movement.amount)) <=
        AMOUNT_TOLERANCE,
  );
  return { statementDate: statement.closedOn, appears, reversalFound };
}
