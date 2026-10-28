/**
 * Helpers for date-only values ('YYYY-MM-DD').
 *
 * They build `Date` objects in the local time zone from the parts and read the
 * parts back with getFullYear/getMonth/getDate, so a value never shifts a day
 * because of UTC conversion (never use `toISOString()` for these).
 */

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True when `value` is a real calendar date written as 'YYYY-MM-DD'. */
function isDateOnly(value: string): boolean {
  return parseDateOnly(value) !== undefined;
}

/** 'YYYY-MM-DD' → local Date at 00:00, or undefined when invalid. */
function parseDateOnly(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  // Reject overflow such as 2026-02-31 (which Date rolls into March).
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

/** Local Date → 'YYYY-MM-DD' (uses local parts, no UTC conversion). */
function toDateOnly(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Adds (or subtracts) whole days to a 'YYYY-MM-DD' value. */
function addDaysToDateOnly(value: string, days: number): string {
  const date = parseDateOnly(value);
  if (!date) throw new Error(`Invalid date-only value: "${value}"`);
  date.setDate(date.getDate() + days);
  return toDateOnly(date);
}

export { addDaysToDateOnly, isDateOnly, parseDateOnly, toDateOnly };
