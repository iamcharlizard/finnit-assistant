/**
 * "Calendario" → Resumen: the month's totals and four charts built from the
 * recurring payments of the next months, the active expenses and the credit
 * cards. Pure: shared by the web and the mobile app.
 */
import {
  addDays,
  dayKeyOf,
  endOfDayIso,
  firstDayOf,
  formatMonthParam,
  lastDayOf,
  monthOf,
  shiftMonth,
  shortMonthLabel,
  startOfDayIso,
  type DayKey,
  type MonthRef,
} from '../finance/dates';
import type { Locale } from '../i18n/locales';
import { formatMoney, roundCents } from '../finance/money';
import type { RecurringKind } from '../finance/types';
import { accountLabel, dayInMonth } from '../finance/accounts';
import type { Localizer } from '../i18n/translator';
import { EXPENSES_PAGE } from '../recurring/request';
import type { RecurringData } from '../recurring/view';
import { buildRecurringView, paymentStatus } from '../recurring/view';

/** How many months the "Próximos meses" chart covers, this one included. */
export const SUMMARY_MONTHS = 6;

/** The request's range: from the first day of this month, six months. */
export function summaryVariables(today: DayKey) {
  const month = monthOf(today);
  return {
    from: startOfDayIso(firstDayOf(month)),
    to: endOfDayIso(lastDayOf(shiftMonth(month, SUMMARY_MONTHS - 1))),
    first: EXPENSES_PAGE,
  };
}

/** Series of the months chart, in their fixed color order. */
export const MONTH_SERIES = ['recurring', 'loans', 'cards'] as const;
export type MonthSeries = (typeof MONTH_SERIES)[number];

export const SERIES_COLOR: Record<MonthSeries, string> = {
  recurring: 'var(--chart-1)',
  loans: 'var(--chart-2)',
  cards: 'var(--chart-3)',
};

/** Loans and installment plans: their own series. */
const LOAN_KINDS: ReadonlySet<RecurringKind> = new Set(['loan', 'installment']);

export interface MonthBar {
  key: string;
  label: string;
  /** Per series, in MONTH_SERIES order. */
  segments: { series: MonthSeries; value: number; amount: string }[];
  value: number;
  total: string;
  /** Height against the tallest month, 0–100. */
  percent: number;
}

export interface Bar {
  key: string;
  label: string;
  value: number;
  amount: string;
  /** Against the largest bar, 0–100. */
  percent: number;
  count: number;
}

export type ProgressPart = 'paid' | 'pending' | 'overdue';

export interface CalendarSummary {
  currency: string;
  monthLabel: string;
  totals: {
    toPay: string;
    toPayCount: number;
    paid: string;
    paidCount: number;
    fixedMonthly: string;
    activeCount: number;
  };
  months: MonthBar[];
  /** Cards with a debt today, counted on their next due date. */
  hasCardEstimate: boolean;
  byKind: Bar[];
  byAccount: Bar[];
  progress: {
    parts: {
      part: ProgressPart;
      value: number;
      amount: string;
      count: number;
      percent: number;
    }[];
    total: string;
    value: number;
  };
}

/** The next time `dueDay` comes on or after `today`. */
export function nextDueDay(dueDay: number, today: DayKey): DayKey {
  const month = monthOf(today);
  const thisMonth = dayKeyIn(month, dueDay);
  return thisMonth >= today
    ? thisMonth
    : dayKeyIn(shiftMonth(month, 1), dueDay);
}

function dayKeyIn(month: MonthRef, day: number): DayKey {
  return addDays(firstDayOf(month), dayInMonth(month, day) - 1);
}

function bars(
  entries: Map<string, { label: string; value: number; count: number }>,
  currency: string,
  locale: Locale,
): Bar[] {
  const list = [...entries.entries()]
    .map(([key, e]) => ({ key, ...e, value: roundCents(e.value) }))
    .filter((e) => e.value > 0)
    .sort(
      (a, b) => b.value - a.value || a.label.localeCompare(b.label, locale),
    );
  const max = Math.max(0, ...list.map((e) => e.value));
  return list.map((e) => ({
    ...e,
    amount: formatMoney(e.value, currency, locale),
    percent: max > 0 ? (e.value / max) * 100 : 0,
  }));
}

export function buildCalendarSummary(
  data: RecurringData,
  today: DayKey,
  l: Localizer,
): CalendarSummary {
  const { locale, t } = l;
  // This month's cards: the same numbers the calendar shows for it.
  const month = buildRecurringView(
    data,
    { view: 'month', date: today, today },
    l,
  );
  const { currency } = month;
  const money = (n: number) => formatMoney(roundCents(n), currency, locale);

  // Next months: what is due, by series (skipped payments left out).
  const first = monthOf(today);
  const keys = Array.from({ length: SUMMARY_MONTHS }, (_, i) =>
    shiftMonth(first, i),
  );
  const sums = new Map(
    keys.map((m) => [
      formatMonthParam(m),
      { recurring: 0, loans: 0, cards: 0 },
    ]),
  );
  for (const payment of data.payments) {
    const expense = payment.recurringExpense;
    if (expense.currency !== currency || payment.status === 'skipped') continue;
    const row = sums.get(formatMonthParam(monthOf(dayKeyOf(payment.dueDate))));
    if (!row) continue;
    row[LOAN_KINDS.has(expense.kind) ? 'loans' : 'recurring'] +=
      payment.expectedAmount;
  }
  let hasCardEstimate = false;
  for (const account of data.accounts) {
    const terms = account.type === 'credit' ? account.creditCardTerms : null;
    const owed = -account.balanceCurrent;
    if (
      !terms ||
      account.archived ||
      account.currency !== currency ||
      owed <= 0
    )
      continue;
    const row = sums.get(
      formatMonthParam(monthOf(nextDueDay(terms.paymentDueDay, today))),
    );
    if (!row) continue;
    row.cards += owed;
    hasCardEstimate = true;
  }
  const monthValues = keys.map((m) => {
    const row = sums.get(formatMonthParam(m))!;
    return { m, row, value: row.recurring + row.loans + row.cards };
  });
  const tallest = Math.max(0, ...monthValues.map((x) => x.value));
  const months: MonthBar[] = monthValues.map(({ m, row, value }) => ({
    key: formatMonthParam(m),
    label: shortMonthLabel(m, locale),
    segments: MONTH_SERIES.map((series) => ({
      series,
      value: roundCents(row[series]),
      amount: money(row[series]),
    })),
    value: roundCents(value),
    total: money(value),
    percent: tallest > 0 ? (value / tallest) * 100 : 0,
  }));

  // Fixed monthly spending by kind and by account (active ones).
  const active = data.expenses.filter(
    (e) => e.active && e.currency === currency,
  );
  const kinds = new Map<
    string,
    { label: string; value: number; count: number }
  >();
  const accounts = new Map<
    string,
    { label: string; value: number; count: number }
  >();
  const accountsById = new Map(data.accounts.map((a) => [a.id, a]));
  for (const e of active) {
    const kind = kinds.get(e.kind) ?? {
      label: t(`finance.recurringKinds.${e.kind}`),
      value: 0,
      count: 0,
    };
    kind.value += e.monthlyCost;
    kind.count += 1;
    kinds.set(e.kind, kind);
    const account = e.accountId ? accountsById.get(e.accountId) : undefined;
    const key = account?.id ?? 'none';
    const entry = accounts.get(key) ?? {
      label: account ? accountLabel(account) : t('calendar.summary.noAccount'),
      value: 0,
      count: 0,
    };
    entry.value += e.monthlyCost;
    entry.count += 1;
    accounts.set(key, entry);
  }

  // This month so far: paid, still to pay, and overdue.
  const range = { start: firstDayOf(first), end: lastDayOf(first) };
  const parts = {
    paid: { value: 0, count: 0 },
    pending: { value: 0, count: 0 },
    overdue: { value: 0, count: 0 },
  };
  for (const payment of data.payments) {
    const day = dayKeyOf(payment.dueDate);
    if (day < range.start || day > range.end) continue;
    if (payment.recurringExpense.currency !== currency) continue;
    const { status, overdue } = paymentStatus(payment, today);
    if (status === 'skipped' || status === 'reminder') continue;
    const part: ProgressPart =
      status === 'paid'
        ? 'paid'
        : overdue || status === 'missed'
          ? 'overdue'
          : 'pending';
    parts[part].value += payment.expectedAmount;
    parts[part].count += 1;
  }
  const progressTotal =
    parts.paid.value + parts.pending.value + parts.overdue.value;

  return {
    currency,
    monthLabel: month.periodLabel,
    totals: month.totals,
    months,
    hasCardEstimate,
    byKind: bars(kinds, currency, locale),
    byAccount: bars(accounts, currency, locale),
    progress: {
      parts: (['paid', 'pending', 'overdue'] as const).map((part) => ({
        part,
        value: roundCents(parts[part].value),
        amount: money(parts[part].value),
        count: parts[part].count,
        percent:
          progressTotal > 0 ? (parts[part].value / progressTotal) * 100 : 0,
      })),
      total: money(progressTotal),
      value: roundCents(progressTotal),
    },
  };
}
