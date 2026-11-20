/**
 * The amount keypad's calculator: an expression of amounts and the four
 * operations ("120+35*2"), typed key by key and worked out without
 * `eval`, × and ÷ before + and −. Amounts keep at most two decimals and
 * results are rounded to cents; a result below zero or a division by zero
 * is no amount.
 */

export type CalcOperator = '+' | '-' | '*' | '/';
export type CalcKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '.'
  | CalcOperator
  | 'back'
  | 'clear'
  | '=';

export type CalcToken =
  | { kind: 'number'; text: string }
  | { kind: 'operator'; operator: CalcOperator };

const OPERATORS = new Set<string>(['+', '-', '*', '/']);
/** Whole digits per amount: up to 9,999,999,999. */
const MAX_WHOLE_DIGITS = 10;
const MAX_DECIMALS = 2;

const isOperator = (char: string | undefined): char is CalcOperator =>
  char !== undefined && OPERATORS.has(char);

/** The expression split into amounts and operators, in order. */
export function calcTokens(expression: string): CalcToken[] {
  const tokens: CalcToken[] = [];
  let number = '';
  for (const char of expression) {
    if (isOperator(char)) {
      if (number) tokens.push({ kind: 'number', text: number });
      tokens.push({ kind: 'operator', operator: char });
      number = '';
    } else {
      number += char;
    }
  }
  if (number) tokens.push({ kind: 'number', text: number });
  return tokens;
}

/** The amount being typed (after the last operator). */
function lastNumber(expression: string): string {
  const tokens = calcTokens(expression);
  const last = tokens[tokens.length - 1];
  return last?.kind === 'number' ? last.text : '';
}

/** Whether the expression has an operation to work out ("120+35"). */
export function hasOperation(expression: string): boolean {
  return calcTokens(expression).some((t) => t.kind === 'operator');
}

/** The expression after pressing `key`; keys that make no sense leave it as is. */
export function pressCalcKey(expression: string, key: CalcKey): string {
  if (key === 'clear') return '';
  if (key === 'back') return expression.slice(0, -1);
  if (key === '=') {
    const result = evaluateCalc(expression);
    return result === null ? expression : amountText(result);
  }
  const last = expression[expression.length - 1];
  if (isOperator(key)) {
    // No amount yet: nothing to operate on (and no negative amounts).
    if (!expression) return expression;
    if (isOperator(last)) return expression.slice(0, -1) + key;
    const trimmed = last === '.' ? expression.slice(0, -1) : expression;
    return trimmed + key;
  }
  const number = lastNumber(expression);
  if (key === '.') {
    if (number.includes('.')) return expression;
    return expression + (number ? '.' : '0.');
  }
  // A digit.
  const [whole = '', decimals] = number.split('.');
  if (decimals !== undefined) {
    return decimals.length >= MAX_DECIMALS ? expression : expression + key;
  }
  if (whole === '0') return expression.slice(0, -1) + key;
  if (whole.length >= MAX_WHOLE_DIGITS) return expression;
  return expression + key;
}

const roundCents = (value: number) =>
  Math.round((value + Math.sign(value) * Number.EPSILON) * 100) / 100;

/**
 * The expression's result, rounded to cents. A trailing operator or "."
 * is ignored ("120+" is 120); null when empty, on a division by zero or
 * when the result is below zero.
 */
export function evaluateCalc(expression: string): number | null {
  const tokens = calcTokens(expression);
  while (tokens.length > 0 && tokens[tokens.length - 1]!.kind === 'operator') {
    tokens.pop();
  }
  if (tokens.length === 0) return null;

  // × and ÷ first, into terms; then add them up with their signs.
  const terms: number[] = [];
  let sign = 1;
  let current: number | null = null;
  let pending: '*' | '/' | null = null;
  for (const token of tokens) {
    if (token.kind === 'number') {
      const value = Number(
        token.text.endsWith('.') ? token.text.slice(0, -1) : token.text,
      );
      if (!Number.isFinite(value)) return null;
      if (current === null) current = value;
      else if (pending === '*') current *= value;
      else if (pending === '/') {
        if (value === 0) return null;
        current /= value;
      }
      pending = null;
    } else if (token.operator === '*' || token.operator === '/') {
      pending = token.operator;
    } else {
      terms.push(sign * (current ?? 0));
      sign = token.operator === '-' ? -1 : 1;
      current = null;
    }
  }
  terms.push(sign * (current ?? 0));
  const result = roundCents(terms.reduce((sum, term) => sum + term, 0));
  return result < 0 ? null : result;
}

/** A result as the forms' raw amount: "190", "1250.5", "0.25". */
export function amountText(value: number): string {
  return String(roundCents(value));
}

/** The form's raw amount as a starting expression ("1250.50" → "1250.50"; junk → ""). */
export function expressionFromAmount(value: string): string {
  return /^\d+(\.\d{0,2})?$/.test(value) ? value : '';
}
