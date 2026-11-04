import { dayKeyOf, type DayKey } from '@/lib/finance/dates';
import { formatMoney } from '@/lib/finance/money';
import type { Localizer } from '@/lib/i18n/translator';
import {
  chartDay,
  dayTimeline,
  type ChartDay,
  type DayTimeline,
} from './balance-history';

export const ALL_BALANCE_FIELDS =
  'currency accounts days { date availableOpening availableClosing debtOpening debtClosing movements complete }';

export interface ApiAllBalanceDay {
  date: string;
  availableOpening: number;
  availableClosing: number;
  debtOpening: number;
  debtClosing: number;
  movements: number;
  complete: boolean;
}

export interface ApiAllBalanceHistory {
  /** Null without accounts. */
  currency: string | null;
  accounts: number;
  /** Newest first. */
  days: ApiAllBalanceDay[];
}

/** All the accounts together on the chosen day, and the chart's two lines. */
export interface OverviewTimeline extends DayTimeline {
  currency: string;
  accounts: number;
  availableOpening: string;
  availableClosing: string;
  /** What is owed on cards (positive). */
  debtOpening: string;
  debtClosing: string;
  movements: number;
  completeFromLabel: string | null;
  /** Oldest first. */
  days: ChartDay[];
  available: { values: number[]; amounts: string[] };
  debt: { values: number[]; amounts: string[] };
  /** Some account is a credit card (otherwise there is no debt line). */
  hasDebt: boolean;
}

export function buildOverviewTimeline(
  history: ApiAllBalanceHistory,
  {
    day,
    today,
    hasCards,
  }: { day: DayKey | null; today: DayKey; hasCards: boolean },
  { locale }: Pick<Localizer, 'locale'>,
): OverviewTimeline | null {
  if (!history.currency || history.accounts === 0) return null;
  const currency = history.currency;
  const chosen = day ?? today;
  const rows = [...history.days].reverse();
  const row = rows.find((r) => dayKeyOf(r.date) === chosen);
  if (!row) return null;
  const money = (amount: number) => formatMoney(amount, currency, locale);
  const firstComplete = rows.find((r) => r.complete);
  const reachesBefore = rows.some((r) => !r.complete);

  return {
    ...dayTimeline(chosen, today, row.complete, locale),
    currency,
    accounts: history.accounts,
    availableOpening: money(row.availableOpening),
    availableClosing: money(row.availableClosing),
    debtOpening: money(row.debtOpening),
    debtClosing: money(row.debtClosing),
    movements: row.movements,
    completeFromLabel:
      reachesBefore && firstComplete
        ? chartDay(dayKeyOf(firstComplete.date), true, locale).title
        : null,
    days: rows.map((r) => chartDay(dayKeyOf(r.date), r.complete, locale)),
    available: {
      values: rows.map((r) => r.availableClosing),
      amounts: rows.map((r) => money(r.availableClosing)),
    },
    debt: {
      values: rows.map((r) => r.debtClosing),
      amounts: rows.map((r) => money(r.debtClosing)),
    },
    hasDebt: hasCards,
  };
}
