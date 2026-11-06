/**
 * Banks and fintechs a Mexican user may hold an account or card with, for
 * the manual account wizard. "Otro" (OTHER_BANK) asks for the name instead.
 */
export const MEXICAN_BANKS = [
  'BBVA',
  'Banamex',
  'Santander',
  'Banorte',
  'HSBC',
  'Scotiabank',
  'Inbursa',
  'Banregio',
  'BanCoppel',
  'Banco Azteca',
  'Afirme',
  'Nu',
  'Hey Banco',
  'Banco del Bienestar',
  'Mercado Pago',
  'Stori',
  'Klar',
  'Spin by OXXO',
  'Rappicard',
  'Openbank',
] as const;

/** Combobox value of "Otro": the user types the bank's name. */
export const OTHER_BANK = '__other__';

/** Search aliases, so "citi" finds Banamex and "oxxo" finds Spin. */
export const BANK_KEYWORDS: Partial<Record<string, string[]>> = {
  Banamex: ['citi', 'citibanamex'],
  'Spin by OXXO': ['oxxo', 'spin'],
  Nu: ['nubank'],
  'Hey Banco': ['hey', 'banregio'],
  'Banco Azteca': ['azteca'],
  'Banco del Bienestar': ['bienestar', 'bansefi'],
};

/** The wizard's bank choice for a stored bank name (known bank, or "Otro"). */
export function bankChoiceOf(bank: string | null | undefined): {
  choice: string;
  other: string;
} {
  if (!bank) return { choice: '', other: '' };
  const known = MEXICAN_BANKS.find(
    (b) => b.toLowerCase() === bank.trim().toLowerCase(),
  );
  return known
    ? { choice: known, other: '' }
    : { choice: OTHER_BANK, other: bank };
}
