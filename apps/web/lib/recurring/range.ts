import type { Locale } from '@/lib/i18n/locales';
import {
  addDays,
  daysInMonth,
  firstDayOf,
  isDayKey,
  lastDayOf,
  longDate,
  monthLabel,
  monthOf,
  parseDayKey,
  shiftMonth,
  shortDate,
  weekdayIndex,
  type DayKey,
} from '@/lib/finance/dates';

/**
 * The visible period of the recurring-payments screen: `view` (day, week or
 * month) around an anchor `date`, both kept in the URL. Weeks start on
 * Monday, as RecurringCalendar is rendered with `weekStartsOn={1}`.
 */
export type RecurringView = 'day' | 'week' | 'month';

export const RECURRING_VIEWS = ['day', 'week', 'month'] as const;
export const DEFAULT_VIEW: RecurringView = 'month';

export interface DayRange {
  start: DayKey;
  end: DayKey;
}

export function parseViewParam(value: unknown): RecurringView {
  return typeof value === 'string' &&
    (RECURRING_VIEWS as ReadonlyArray<string>).includes(value)
    ? (value as RecurringView)
    : DEFAULT_VIEW;
}

/**
 * The anchor date from `?date=YYYY-MM-DD`, else the old calendar's
 * `?month=YYYY-MM` (its first day, or today when it is this month), else
 * today.
 */
export function parseDateParam(
  { date, month }: { date?: unknown; month?: unknown },
  today: DayKey,
): DayKey {
  if (isDayKey(date) && inSupportedYears(date)) return date;
  if (typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) {
    const first = `${month}-01`;
    if (isDayKey(first) && inSupportedYears(first)) {
      return month === today.slice(0, 7) ? today : first;
    }
  }
  return today;
}

function inSupportedYears(key: DayKey): boolean {
  const { year } = parseDayKey(key);
  return year >= 2000 && year <= 2100;
}

export function startOfWeek(date: DayKey): DayKey {
  return addDays(date, -weekdayIndex(date));
}

/** The days the view shows, inclusive. */
export function visibleRange(view: RecurringView, date: DayKey): DayRange {
  if (view === 'day') return { start: date, end: date };
  if (view === 'week') {
    const start = startOfWeek(date);
    return { start, end: addDays(start, 6) };
  }
  const month = monthOf(date);
  return { start: firstDayOf(month), end: lastDayOf(month) };
}

/** The anchor of the previous (-1) or next (1) period. */
export function shiftDate(
  view: RecurringView,
  date: DayKey,
  direction: 1 | -1,
): DayKey {
  if (view === 'day') return addDays(date, direction);
  if (view === 'week') return addDays(date, 7 * direction);
  // Keep the day of the month when it exists (Jan 31 → Feb 28).
  const target = shiftMonth(monthOf(date), direction);
  const day = Math.min(parseDayKey(date).day, daysInMonth(target));
  return `${firstDayOf(target).slice(0, 8)}${String(day).padStart(2, '0')}`;
}

export function inRange(day: DayKey, range: DayRange): boolean {
  return day >= range.start && day <= range.end;
}

/** Every day of the range, in order. */
export function daysOf(range: DayRange): DayKey[] {
  const days: DayKey[] = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) days.push(d);
  return days;
}

export function recurringHref({
  view,
  date,
}: {
  view: RecurringView;
  date: DayKey;
}): string {
  const params = new URLSearchParams();
  if (view !== DEFAULT_VIEW) params.set('view', view);
  params.set('date', date);
  return `/recurring?${params.toString()}`;
}

/** "Octubre 2026", "12–18 oct" or "13 de octubre", for sentences and cards. */
export function periodLabel(
  view: RecurringView,
  date: DayKey,
  today: DayKey,
  locale: Locale,
): string {
  if (view === 'month') return monthLabel(monthOf(date), locale);
  if (view === 'day') return longDate(date, today, locale);
  const { start, end } = visibleRange('week', date);
  const s = parseDayKey(start);
  const e = parseDayKey(end);
  if (s.month === e.month) {
    const short = shortDate(end, locale);
    return locale === 'en'
      ? short.replace(/(\d+)$/, `${s.day}–$1`)
      : `${s.day}–${short}`;
  }
  return `${shortDate(start, locale)} – ${shortDate(end, locale)}`;
}
