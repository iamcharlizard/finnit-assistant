import {
  addDays,
  dayKeyOf,
  daysBetween,
  fullDate,
  isDayKey,
  shortDate,
  type DayKey,
} from '../finance/dates';
import { formatMoney } from '../finance/money';
import type { Localizer } from '../i18n/translator';

export const BALANCE_HISTORY_FIELDS =
  'accountId currency completeFrom days { date openingBalance closingBalance inflow outflow movements complete }';

export interface ApiBalanceDay {
  date: string;
  openingBalance: number;
  closingBalance: number;
  inflow: number;
  outflow: number;
  movements: number;
  complete: boolean;
}

export interface ApiBalanceHistory {
  accountId: string;
  currency: string;
  completeFrom: string;
  /** Newest first. */
  days: ApiBalanceDay[];
}

/** Days the chart shows by default (ending today). */
export const CHART_DAYS = 90;
/** Days before a chosen older day that the chart also shows. */
const CONTEXT_DAYS = 14;
/** Longest range the API returns. */
const MAX_DAYS = 366;

/**
 * The day in `?day=`: a past day, or null for today (missing, invalid,
 * today or later all mean today).
 */
export function parseDayParam(
  value: string | string[] | undefined,
  today: DayKey,
): DayKey | null {
  const day = Array.isArray(value) ? value[0] : value;
  return isDayKey(day) && day < today ? day : null;
}

/** The days the chart covers: the last 90, or around an older chosen day. */
export function historyWindow(
  day: DayKey | null,
  today: DayKey,
): { from: DayKey; to: DayKey } {
  const recent = addDays(today, -(CHART_DAYS - 1));
  if (!day || day >= recent) return { from: recent, to: today };
  const from = addDays(day, -CONTEXT_DAYS);
  const last = addDays(from, MAX_DAYS - 1);
  return { from, to: last < today ? last : today };
}

export interface BalancePoint extends ChartDay {
  /** Balance (credit cards: what is owed). */
  value: number;
  /** Formatted value. */
  amount: string;
}

/** The chosen day and how to move from it (one account or all of them). */
export interface DayTimeline {
  day: DayKey;
  /** Today, as the server saw it. */
  today: DayKey;
  isToday: boolean;
  /** "3 de noviembre de 2026" */
  dayLabel: string;
  previousDay: DayKey;
  /** Null on today. */
  nextDay: DayKey | null;
  /** The chosen day's figures can be trusted. */
  complete: boolean;
}

/** A day on the chart's x axis. */
export interface ChartDay {
  day: DayKey;
  /** "3 nov" */
  label: string;
  /** "3 de noviembre de 2026" */
  title: string;
  complete: boolean;
}

/** The chosen day's place in time (shared by the account and the overview). */
export function dayTimeline(
  chosen: DayKey,
  today: DayKey,
  complete: boolean,
  locale: Localizer['locale'],
): DayTimeline {
  return {
    day: chosen,
    today,
    isToday: chosen === today,
    dayLabel: fullDate(chosen, locale),
    previousDay: addDays(chosen, -1),
    nextDay: chosen < today ? addDays(chosen, 1) : null,
    complete,
  };
}

/** "3 nov" and "3 de noviembre de 2026" for a chart day. */
export function chartDay(
  day: DayKey,
  complete: boolean,
  locale: Localizer['locale'],
): ChartDay {
  return {
    day,
    label: shortDate(day, locale),
    title: fullDate(day, locale),
    complete,
  };
}

export interface BalanceTimeline extends DayTimeline {
  /** Credit cards show what is owed. */
  isCredit: boolean;
  opening: string;
  closing: string;
  inflow: string;
  outflow: string;
  movements: number;
  /** First trusted day, when the chart reaches before it. */
  completeFromLabel: string | null;
  /** Oldest day first. */
  points: BalancePoint[];
}

/**
 * The chosen day's figures and the chart's points. A credit card's balance
 * is negative (what is owed); it is shown as a positive debt.
 */
export function buildBalanceTimeline(
  history: ApiBalanceHistory,
  {
    day,
    today,
    isCredit,
  }: { day: DayKey | null; today: DayKey; isCredit: boolean },
  { locale }: Localizer,
): BalanceTimeline | null {
  const chosen = day ?? today;
  const rows = [...history.days].reverse();
  const row = rows.find((r) => dayKeyOf(r.date) === chosen);
  if (!row) return null;
  const shown = (balance: number) => (isCredit ? -balance : balance);
  const money = (amount: number) =>
    formatMoney(amount, history.currency, locale);
  const completeFrom = dayKeyOf(history.completeFrom);
  const reachesBefore = rows.some((r) => !r.complete);

  return {
    ...dayTimeline(chosen, today, row.complete, locale),
    isCredit,
    opening: money(shown(row.openingBalance)),
    closing: money(shown(row.closingBalance)),
    inflow: money(row.inflow),
    outflow: money(row.outflow),
    movements: row.movements,
    completeFromLabel:
      reachesBefore && daysBetween(completeFrom, today) >= 0
        ? fullDate(completeFrom, locale)
        : null,
    points: rows.map((r) => {
      const key = dayKeyOf(r.date);
      const value = shown(r.closingBalance);
      return {
        ...chartDay(key, r.complete, locale),
        value,
        amount: money(value),
      };
    }),
  };
}
