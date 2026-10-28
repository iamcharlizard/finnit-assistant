import type { Locale } from '@/lib/i18n/locales';

/**
 * Money formatting that gives the same text on the server and in the
 * browser (Intl output can differ between Node's and browsers' ICU data and
 * break hydration): "$1,234.56", "-$80.00", "US$12.00".
 *
 * Fixed conventions per language. es-MX and en-US happen to write money the
 * same way (comma groups, dot decimals); MXN keeps "$" in English too, since
 * it is the app's home currency.
 */
interface MoneyConventions {
  group: string;
  decimal: string;
  symbols: Record<string, string>;
}

const CONVENTIONS: Record<Locale, MoneyConventions> = {
  es: { group: ',', decimal: '.', symbols: { MXN: '$', USD: 'US$', EUR: '€' } },
  en: { group: ',', decimal: '.', symbols: { MXN: '$', USD: 'US$', EUR: '€' } },
};

export const DEFAULT_CURRENCY = 'MXN';

export interface MoneyOptions {
  /** negative: "-" only when below zero; always: "+"/"-"; never: absolute value. */
  sign?: 'negative' | 'always' | 'never';
  /** Whole units ("$1,235") instead of cents. */
  wholeUnits?: boolean;
}

export function formatMoney(
  amount: number,
  currency: string,
  locale: Locale,
  { sign = 'negative', wholeUnits = false }: MoneyOptions = {},
): string {
  const { group, decimal, symbols } = CONVENTIONS[locale];
  const decimals = wholeUnits ? 0 : 2;
  const rounded = Number(Math.abs(amount).toFixed(decimals));
  const [integer, cents] = rounded.toFixed(decimals).split('.');
  const symbol = symbols[currency] ?? `${currency} `;
  const grouped = (integer ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const body = `${symbol}${grouped}${cents ? `${decimal}${cents}` : ''}`;

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
