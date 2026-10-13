const SPANISH_MONTHS: Record<string, number> = {
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  set: 9,
  oct: 10,
  nov: 11,
  dic: 12,
};

/**
 * Parses an amount as printed in Mexican statements: "$1,234.56", "1 234.56",
 * "-450.00", "450.00-" or "(450.00)". Returns null when it isn't a number.
 */
export function parseAmount(raw: string): number | null {
  let text = raw.trim().replace(/\s+/g, '');
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.startsWith('-')) {
    negative = true;
    text = text.slice(1);
  } else if (text.endsWith('-')) {
    negative = true;
    text = text.slice(0, -1);
  }
  text = text.replace(/^\+/, '').replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const value = Number(text);
  return negative ? -value : value;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Parses "15-ene-2026", "15 ene 2026", "15/01/2026", "15-01-26" or
 * "2026-01-15" into YYYY-MM-DD. Day-first, as in Mexican documents.
 * `fallbackYear` completes dates printed without a year ("15-ene").
 */
export function parseDate(raw: string, fallbackYear?: number): string | null {
  const text = raw.trim().toLowerCase().replace(/\./g, '');

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const named =
    /^(\d{1,2})[\s/-]+([a-zñ]{3})[a-zñ]*(?:[\s/-]+(\d{2,4}))?$/.exec(text);
  if (named) {
    const month = SPANISH_MONTHS[named[2]];
    const year = named[3] ? normalizeYear(Number(named[3])) : fallbackYear;
    if (!month || !year) return null;
    return isoDate(year, month, Number(named[1]));
  }

  const numeric = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/.exec(text);
  if (numeric) {
    const year = numeric[3] ? normalizeYear(Number(numeric[3])) : fallbackYear;
    if (!year) return null;
    return isoDate(year, Number(numeric[2]), Number(numeric[1]));
  }
  return null;
}

function normalizeYear(year: number): number {
  return year < 100 ? 2000 + year : year;
}

/** Uppercase, accents removed, single spaces: for comparing merchant names. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
