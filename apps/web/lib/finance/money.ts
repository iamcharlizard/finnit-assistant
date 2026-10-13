/**
 * Money formatting that gives the same text on the server and in the
 * browser (Intl output can differ between Node's and browsers' ICU data and
 * break hydration): "$1,234.56", "-$80.00", "US$12.00".
 */
const SYMBOLS: Record<string, string> = { MXN: '$', USD: 'US$', EUR: '€' };

export const DEFAULT_CURRENCY = 'MXN';

export interface MoneyOptions {
  /** negative: "-" only when below zero; always: "+"/"-"; never: absolute value. */
  sign?: 'negative' | 'always' | 'never';
  /** Whole units ("$1,235") instead of cents. */
  wholeUnits?: boolean;
}

function group(integer: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatMoney(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  { sign = 'negative', wholeUnits = false }: MoneyOptions = {},
): string {
  const decimals = wholeUnits ? 0 : 2;
  const rounded = Number(Math.abs(amount).toFixed(decimals));
  const [integer, cents] = rounded.toFixed(decimals).split('.');
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const body = `${symbol}${group(integer ?? '0')}${cents ? `.${cents}` : ''}`;

  const isZero = rounded === 0;
  if (sign === 'never' || isZero) return body;
  if (amount < 0) return `-${body}`;
  return sign === 'always' ? `+${body}` : body;
}

/** Rounds to cents, avoiding float noise when adding amounts. */
export function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** 0–100, rounded; 0 when the total is not positive. */
export function percentOf(part: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.round((part / total) * 100);
}
