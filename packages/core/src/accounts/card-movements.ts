/**
 * A credit card's "Movimientos" tab: its movements of one billing cycle
 * (de corte a corte) or one calendar month, by day, with what was spent
 * and paid in that range. Loaded on the client when a period or month is
 * picked. Shared by the web and the mobile app.
 */
import { CATEGORIZE_FIELDS } from '../categorize/types';
import {
  dayKeyOf,
  endOfDayIso,
  firstDayOf,
  lastDayOf,
  monthLabel,
  monthOf,
  shiftMonth,
  startOfDayIso,
  type DayKey,
  type MonthRef,
} from '../finance/dates';
import { indexCategories } from '../finance/categories';
import { formatMoney, roundCents } from '../finance/money';
import { groupByDay, type TransactionGroup } from '../finance/transactions';
import {
  CATEGORY_FIELDS,
  type ApiCategory,
  type Connection,
} from '../finance/types';
import type { CategorizeTransaction } from '../categorize/types';
import type { Localizer } from '../i18n/translator';
import { toHistoryRow, type HistoryRow } from '../history/view';

/** More than a card has in a month, in practice. */
export const CARD_MOVEMENTS_PAGE = 200;

export const CARD_MOVEMENTS_QUERY = `query CardMovements($accountId: String!, $from: DateTime!, $to: DateTime!, $first: Int!) {
  transactions(first: $first, filters: { accountId: $accountId, startDate: $from, endDate: $to }) {
    totalCount
    edges { node { ${CATEGORIZE_FIELDS} } }
  }
  categories(includeHidden: true) { ${CATEGORY_FIELDS} }
}`;

export interface CardMovementsResult {
  transactions: Connection<CategorizeTransaction> & { totalCount: number };
  categories: ApiCategory[];
}

export type CardMovementsMode = 'period' | 'month';

/** A day range to show: a cycle or a month. */
export interface CardRange {
  from: DayKey;
  to: DayKey;
}

export function cardMovementsVariables(accountId: string, range: CardRange) {
  return {
    accountId,
    from: startOfDayIso(range.from),
    to: endOfDayIso(range.to),
    first: CARD_MOVEMENTS_PAGE,
  };
}

/** A cycle's range: the day after the previous cut-off to its cut-off. */
export function periodRange(period: {
  periodStart: string;
  statementDate: string;
}): CardRange {
  return {
    from: dayKeyOf(period.periodStart),
    to: dayKeyOf(period.statementDate),
  };
}

export interface MonthChoice {
  key: string;
  label: string;
  range: CardRange;
}

/** This month and the `count − 1` before it, newest first. */
export function monthChoices(
  today: DayKey,
  count: number,
  { locale }: Pick<Localizer, 'locale'>,
): MonthChoice[] {
  const current = monthOf(today);
  return Array.from({ length: count }, (_, i) => {
    const month: MonthRef = shiftMonth(current, -i);
    return {
      key: `${month.year}-${String(month.month).padStart(2, '0')}`,
      label: monthLabel(month, locale),
      range: { from: firstDayOf(month), to: lastDayOf(month) },
    };
  });
}

export interface CardMovementsView {
  groups: TransactionGroup<HistoryRow>[];
  count: number;
  /** Charges counted in the range (expenses). */
  spent: string;
  /** Money in (payments, refunds). */
  paidIn: string;
  /** More than one page: the rest are in the history. */
  truncated: boolean;
  historyHref: string;
}

export function buildCardMovements(
  data: CardMovementsResult,
  {
    accountId,
    range,
    today,
  }: { accountId: string; range: CardRange; today: DayKey },
  l: Localizer,
): CardMovementsView {
  const categories = indexCategories(data.categories);
  const rows = data.transactions.edges.map((e) =>
    toHistoryRow(e.node, categories, l),
  );
  const currency = rows[0]?.currency ?? 'MXN';
  let spent = 0;
  let paidIn = 0;
  for (const row of rows) {
    if (row.status === 'cancelled' || row.status === 'pending') continue;
    if (row.variant === 'expense') spent += row.value;
    else if (row.variant === 'income') paidIn += row.value;
  }
  const params = new URLSearchParams({
    account: accountId,
    from: range.from,
    to: range.to,
  });
  return {
    groups: groupByDay(rows, today, l.locale),
    count: data.transactions.totalCount,
    spent: formatMoney(roundCents(spent), currency, l.locale),
    paidIn: formatMoney(roundCents(paidIn), currency, l.locale),
    truncated: data.transactions.totalCount > rows.length,
    historyHref: `/history?${params.toString()}`,
  };
}
