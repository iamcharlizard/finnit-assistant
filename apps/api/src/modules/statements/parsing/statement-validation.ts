import { DEBIT_KINDS, ParsedStatement } from './parsed-statement';
import { roundMoney } from './parse-utils';

/** Differences up to this amount are rounding, not missing movements. */
export const BALANCE_TOLERANCE = 1;

export interface StatementCheck {
  /** Charges minus credits of the extracted lines. */
  linesNet: number;
  /** previousBalance + linesNet: what the statement balance should be. */
  computedTotal: number | null;
  /** statementBalance − computedTotal; null when the statement lacks totals. */
  difference: number | null;
  balanced: boolean;
}

/**
 * Checks that the extracted movements explain the statement balance:
 * previous balance + charges − credits = balance at cut-off.
 */
export function checkStatement(statement: ParsedStatement): StatementCheck {
  const linesNet = roundMoney(
    statement.lines.reduce(
      (sum, line) =>
        sum + (DEBIT_KINDS.has(line.kind) ? line.amount : -line.amount),
      0,
    ),
  );

  if (
    statement.previousBalance === undefined ||
    statement.statementBalance === undefined
  ) {
    return { linesNet, computedTotal: null, difference: null, balanced: false };
  }

  const computedTotal = roundMoney(statement.previousBalance + linesNet);
  const difference = roundMoney(statement.statementBalance - computedTotal);
  return {
    linesNet,
    computedTotal,
    difference,
    balanced: Math.abs(difference) <= BALANCE_TOLERANCE,
  };
}
