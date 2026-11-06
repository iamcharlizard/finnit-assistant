/**
 * How money is typed and shown in each country: currency, symbol and the
 * separators. Inputs keep a raw value (digits and an optional "." with up to
 * `decimals` digits, e.g. "1250000.5") and only the display uses these
 * separators, so forms parse amounts the same way in every country.
 */
export interface MoneyFormat {
  /** ISO 3166-1 alpha-2. */
  country: string;
  /** ISO 4217 code shown next to the amount. */
  currency: string;
  symbol: string;
  symbolPosition: 'prefix' | 'suffix';
  /** Between thousands (1,000). */
  groupSeparator: string;
  /**
   * Between millions (1'000,000), and every other group after that
   * (1,000'000,000). Same as `groupSeparator` where millions aren't marked.
   */
  millionsSeparator: string;
  decimalSeparator: string;
  /** Digits after the decimal separator (0 for currencies without cents). */
  decimals: number;
}

export const MONEY_FORMATS = {
  MX: {
    country: 'MX',
    currency: 'MXN',
    symbol: '$',
    symbolPosition: 'prefix',
    groupSeparator: ',',
    millionsSeparator: "'",
    decimalSeparator: '.',
    decimals: 2,
  },
  US: {
    country: 'US',
    currency: 'USD',
    symbol: '$',
    symbolPosition: 'prefix',
    groupSeparator: ',',
    millionsSeparator: ',',
    decimalSeparator: '.',
    decimals: 2,
  },
  CO: {
    country: 'CO',
    currency: 'COP',
    symbol: '$',
    symbolPosition: 'prefix',
    groupSeparator: '.',
    millionsSeparator: "'",
    decimalSeparator: ',',
    decimals: 2,
  },
  AR: {
    country: 'AR',
    currency: 'ARS',
    symbol: '$',
    symbolPosition: 'prefix',
    groupSeparator: '.',
    millionsSeparator: '.',
    decimalSeparator: ',',
    decimals: 2,
  },
  CL: {
    country: 'CL',
    currency: 'CLP',
    symbol: '$',
    symbolPosition: 'prefix',
    groupSeparator: '.',
    millionsSeparator: '.',
    decimalSeparator: ',',
    decimals: 0,
  },
  PE: {
    country: 'PE',
    currency: 'PEN',
    symbol: 'S/',
    symbolPosition: 'prefix',
    groupSeparator: ',',
    millionsSeparator: ',',
    decimalSeparator: '.',
    decimals: 2,
  },
  ES: {
    country: 'ES',
    currency: 'EUR',
    symbol: '€',
    symbolPosition: 'suffix',
    groupSeparator: '.',
    millionsSeparator: '.',
    decimalSeparator: ',',
    decimals: 2,
  },
} as const satisfies Record<string, MoneyFormat>;

export type MoneyCountry = keyof typeof MONEY_FORMATS;

export const DEFAULT_MONEY_COUNTRY: MoneyCountry = 'MX';

/** Symbols of currencies an account may use in another country's format. */
const CURRENCY_SYMBOLS: Record<string, string> = {
  MXN: '$',
  USD: 'US$',
  EUR: '€',
  COP: '$',
  ARS: '$',
  CLP: '$',
  PEN: 'S/',
};

/**
 * The country's format, or one of its fields overridden: e.g. an account in
 * USD typed with Mexican separators shows "US$ … USD".
 */
export function moneyFormat(
  country: MoneyCountry | MoneyFormat = DEFAULT_MONEY_COUNTRY,
  currency?: string,
): MoneyFormat {
  const base: MoneyFormat =
    typeof country === 'string' ? MONEY_FORMATS[country] : country;
  if (!currency || currency === base.currency) return base;
  return {
    ...base,
    currency,
    symbol: CURRENCY_SYMBOLS[currency] ?? currency,
  };
}

/**
 * The raw value of anything typed or pasted in the format: digits, and the
 * format's decimal separator once (kept even with no digits after it yet,
 * so "12." stays while typing). Everything else is dropped.
 */
export function sanitizeMoneyText(text: string, format: MoneyFormat): string {
  let integer = '';
  let fraction = '';
  let hasDecimal = false;
  for (const char of text) {
    if (char >= '0' && char <= '9') {
      if (!hasDecimal) integer += char;
      else if (fraction.length < format.decimals) fraction += char;
    } else if (
      char === format.decimalSeparator &&
      format.decimals > 0 &&
      !hasDecimal
    ) {
      hasDecimal = true;
    }
  }
  integer = integer.replace(/^0+(?=\d)/, '');
  if (hasDecimal) return `${integer || '0'}.${fraction}`;
  return integer;
}

/**
 * A stored value ("1250000.5", or older text like "1,250,000.50" or
 * "$200") as the raw value. The stored decimal mark is always ".".
 */
export function normalizeMoneyValue(value: string, decimals = 2): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const [integer = '', ...rest] = cleaned.split('.');
  const int = integer.replace(/^0+(?=\d)/, '');
  if (rest.length === 0 || decimals === 0) return int;
  return `${int || '0'}.${rest.join('').slice(0, decimals)}`;
}

/** "1250000.5" → "1'250,000.5" (MX); no symbol. */
export function formatMoneyText(raw: string, format: MoneyFormat): string {
  if (!raw) return '';
  const [integer = '', fraction] = raw.split('.');
  const groups: string[] = [];
  for (let end = integer.length; end > 0; end -= 3) {
    groups.unshift(integer.slice(Math.max(0, end - 3), end));
  }
  let grouped = groups[groups.length - 1] ?? '';
  // Separators from the right: 1st thousands, 2nd millions, 3rd thousands…
  for (let i = groups.length - 2, k = 1; i >= 0; i -= 1, k += 1) {
    const separator =
      k % 2 === 0 ? format.millionsSeparator : format.groupSeparator;
    grouped = `${groups[i]}${separator}${grouped}`;
  }
  return fraction === undefined
    ? grouped
    : `${grouped || '0'}${format.decimalSeparator}${fraction}`;
}

/** Fills the cents when leaving the field: "1200" → "1200.00". */
export function completeMoneyValue(raw: string, decimals = 2): string {
  if (!raw || decimals === 0) return raw.replace(/\.$/, '');
  const [integer = '0', fraction = ''] = raw.split('.');
  return `${integer || '0'}.${fraction.padEnd(decimals, '0')}`;
}

/** Digits and the decimal separator in `text`: what the caret is placed by. */
export function countMoneyTokens(text: string, format: MoneyFormat): number {
  let count = 0;
  let seenDecimal = false;
  for (const char of text) {
    if (char >= '0' && char <= '9') count += 1;
    else if (char === format.decimalSeparator && !seenDecimal) {
      seenDecimal = true;
      count += 1;
    }
  }
  return count;
}

/** Where the caret goes in `display` so `tokens` digits/decimal sit before it. */
export function caretForTokens(
  display: string,
  tokens: number,
  format: MoneyFormat,
): number {
  if (tokens <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < display.length; i += 1) {
    const char = display[i]!;
    if ((char >= '0' && char <= '9') || char === format.decimalSeparator) {
      seen += 1;
      if (seen === tokens) return i + 1;
    }
  }
  return display.length;
}
