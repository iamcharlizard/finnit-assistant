/**
 * Calendar days for the finance screens, in Mexico City time. Days travel as
 * "YYYY-MM-DD" keys and every label is built from fixed Spanish names, so the
 * server and the browser render the same text.
 *
 * The API stores transaction and due dates as calendar dates (DATE columns),
 * returned as midnight UTC: their UTC date is the day. Any other instant
 * (e.g. a projection date) is read in Mexico City time.
 */
export const TIME_ZONE = 'America/Mexico_City';

/** "2026-10-14" */
export type DayKey = string;

export interface MonthRef {
  year: number;
  /** 1–12 */
  month: number;
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const WEEKDAYS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

// Only numeric parts are read, which every ICU build formats the same way.
const zoned = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function zonedParts(date: Date) {
  const parts = Object.fromEntries(
    zoned.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Midnight UTC exactly: a date the API stored without a time of day. */
export function isDateOnly(value: string | Date): boolean {
  const date = new Date(value);
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

/** The calendar day of an API date. */
export function dayKeyOf(value: string | Date): DayKey {
  const date = new Date(value);
  if (isDateOnly(date)) return date.toISOString().slice(0, 10);
  return zonedParts(date).day;
}

/** "14:32" in Mexico City, or null for dates without a time of day. */
export function timeOf(value: string | Date): string | null {
  const date = new Date(value);
  return isDateOnly(date) ? null : zonedParts(date).time;
}

export function todayKey(now: Date = new Date()): DayKey {
  return zonedParts(now).day;
}

export function parseDayKey(key: DayKey): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = key.split('-').map(Number);
  return { year: year!, month: month!, day: day! };
}

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const { year, month, day } = parseDayKey(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === value;
}

function keyToUtc(key: DayKey): Date {
  const { year, month, day } = parseDayKey(key);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(key: DayKey, days: number): DayKey {
  const date = keyToUtc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round(
    (keyToUtc(to).getTime() - keyToUtc(from).getTime()) / 86_400_000,
  );
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(key: DayKey): number {
  return (keyToUtc(key).getUTCDay() + 6) % 7;
}

/** Start of the day (UTC midnight) as the API expects in date filters. */
export function startOfDayIso(key: DayKey): string {
  return `${key}T00:00:00.000Z`;
}

export function endOfDayIso(key: DayKey): string {
  return `${key}T23:59:59.999Z`;
}

// Months

export function monthOf(key: DayKey): MonthRef {
  const { year, month } = parseDayKey(key);
  return { year, month };
}

export function shiftMonth({ year, month }: MonthRef, delta: number): MonthRef {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function daysInMonth({ year, month }: MonthRef): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function firstDayOf(m: MonthRef): DayKey {
  return `${m.year}-${pad(m.month)}-01`;
}

export function lastDayOf(m: MonthRef): DayKey {
  return `${m.year}-${pad(m.month)}-${pad(daysInMonth(m))}`;
}

export function sameMonth(a: MonthRef, b: MonthRef): boolean {
  return a.year === b.year && a.month === b.month;
}

/** "2026-10" */
export function formatMonthParam({ year, month }: MonthRef): string {
  return `${year}-${pad(month)}`;
}

/** Reads "2026-10" from a search param; anything else gives the fallback. */
export function parseMonthParam(
  value: string | string[] | undefined,
  fallback: MonthRef,
): MonthRef {
  const match =
    typeof value === 'string' ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  if (!match) return fallback;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return fallback;
  return { year, month };
}

/** "Octubre 2026" */
export function monthLabel({ year, month }: MonthRef): string {
  return `${capitalize(MONTHS[month - 1]!)} ${year}`;
}

/** "Oct" */
export function shortMonthLabel({ month }: MonthRef): string {
  return capitalize(MONTHS[month - 1]!.slice(0, 3));
}

// Day labels

/** "14 de octubre", with the year when it isn't `today`'s. */
export function longDate(key: DayKey, today: DayKey): string {
  const { year, month, day } = parseDayKey(key);
  const sameYear = year === parseDayKey(today).year;
  return `${day} de ${MONTHS[month - 1]}${sameYear ? '' : ` de ${year}`}`;
}

/** "14 oct" */
export function shortDate(key: DayKey): string {
  const { month, day } = parseDayKey(key);
  return `${day} ${MONTHS[month - 1]!.slice(0, 3)}`;
}

/** Group heading: "Hoy, 14 de octubre", "Ayer, …", "Lunes, 12 de octubre". */
export function dayHeading(key: DayKey, today: DayKey): string {
  const offset = daysBetween(key, today);
  const prefix =
    offset === 0
      ? 'Hoy'
      : offset === 1
        ? 'Ayer'
        : capitalize(WEEKDAYS[keyToUtc(key).getUTCDay()]!);
  return `${prefix}, ${longDate(key, today)}`;
}

/** Due date relative to today: "Hoy", "Mañana", "En 3 días", "Hace 2 días". */
export function relativeDayLabel(key: DayKey, today: DayKey): string {
  const offset = daysBetween(today, key);
  if (offset === 0) return 'Hoy';
  if (offset === 1) return 'Mañana';
  if (offset === -1) return 'Ayer';
  return offset > 0 ? `En ${offset} días` : `Hace ${-offset} días`;
}
