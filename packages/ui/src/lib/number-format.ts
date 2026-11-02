/** What a NumberInput lets through. */
export interface NumberRules {
  /** Digits after the decimal point; 0 = whole numbers only (default). */
  decimals?: number;
  /** A leading "-" is allowed. */
  allowNegative?: boolean;
  /** Most digits before the decimal point (e.g. 2 for a day of the month). */
  maxDigits?: number;
}

/**
 * Typed or pasted text as a plain number: digits, a leading "-" when
 * allowed, and one decimal point (a comma counts as one) with at most
 * `decimals` digits after it. Letters and anything else are dropped. A
 * trailing "." stays while typing ("12.").
 */
export function sanitizeNumberText(
  text: string,
  { decimals = 0, allowNegative = false, maxDigits }: NumberRules = {},
): string {
  let sign = '';
  let integer = '';
  let fraction = '';
  let hasDecimal = false;
  for (const char of text.trim()) {
    if (char >= '0' && char <= '9') {
      if (!hasDecimal) {
        if (maxDigits === undefined || integer.length < maxDigits) {
          integer += char;
        }
      } else if (fraction.length < decimals) {
        fraction += char;
      }
    } else if ((char === '.' || char === ',') && decimals > 0 && !hasDecimal) {
      hasDecimal = true;
    } else if (
      char === '-' &&
      allowNegative &&
      !sign &&
      !integer &&
      !hasDecimal
    ) {
      sign = '-';
    }
  }
  if (hasDecimal) return `${sign}${integer || '0'}.${fraction}`;
  return `${sign}${integer}`;
}
