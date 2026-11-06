import {
  endOfDayIso,
  firstDayOf,
  formatMonthParam,
  isDayKey,
  lastDayOf,
  monthOf,
  parseMonthParam,
  sameMonth,
  shiftMonth,
  startOfDayIso,
  todayKey,
  type DayKey,
  type MonthRef,
} from '@/lib/finance/dates';

/**
 * History filters. They live in the URL (?type=expense&account=…&month=…),
 * so a filtered view can be shared or reloaded, and the server renders the
 * first page already filtered. The list goes month by month (this month
 * when the URL says nothing); `month=all` shows the whole history, and a
 * `from`/`to` range replaces the month.
 */
export type HistoryType = 'income' | 'expense' | 'transfer';

/** A month, or the whole history. */
export type HistoryPeriod = MonthRef | 'all';

export interface HistoryFilters {
  type?: HistoryType;
  accountId?: string;
  categoryId?: string;
  from?: DayKey;
  to?: DayKey;
  search?: string;
  /** Ignored while a from/to range is set. */
  period: HistoryPeriod;
}

export const HISTORY_PAGE_SIZE = 30;

/** The type chips, in order; labels are `history.types.<value>`. */
export const TYPE_OPTIONS: ReadonlyArray<HistoryType | 'all'> = [
  'all',
  'income',
  'expense',
  'transfer',
];

type Params = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const ID = /^[\w-]{1,64}$/;

export function parseHistoryFilters(
  params: Params,
  today: DayKey = todayKey(),
): HistoryFilters {
  const type = one(params.type);
  const accountId = one(params.account);
  const categoryId = one(params.category);
  const from = one(params.from);
  const to = one(params.to);
  const search = one(params.q)?.slice(0, 100);
  const month = one(params.month);
  return {
    ...(type && TYPE_OPTIONS.some((o) => o === type && type !== 'all')
      ? { type: type as HistoryType }
      : {}),
    ...(accountId && ID.test(accountId) ? { accountId } : {}),
    ...(categoryId && ID.test(categoryId) ? { categoryId } : {}),
    ...(isDayKey(from) ? { from } : {}),
    ...(isDayKey(to) ? { to } : {}),
    ...(search ? { search } : {}),
    period: month === 'all' ? 'all' : parseMonthParam(month, monthOf(today)),
  };
}

/** A from/to range replaces the month. */
export function hasRange(filters: HistoryFilters): boolean {
  return Boolean(filters.from || filters.to);
}

/** The month the list shows, or null (whole history or a range). */
export function shownMonth(filters: HistoryFilters): MonthRef | null {
  return hasRange(filters) || filters.period === 'all' ? null : filters.period;
}

/** The URL query for some filters ("" for this month without filters). */
export function historyQuery(
  filters: HistoryFilters,
  today: DayKey = todayKey(),
): string {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.accountId) params.set('account', filters.accountId);
  if (filters.categoryId) params.set('category', filters.categoryId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.search) params.set('q', filters.search);
  if (!hasRange(filters)) {
    if (filters.period === 'all') params.set('month', 'all');
    else if (!sameMonth(filters.period, monthOf(today))) {
      params.set('month', formatMonthParam(filters.period));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function historyHref(
  filters: HistoryFilters,
  today: DayKey = todayKey(),
): string {
  return `/history${historyQuery(filters, today)}`;
}

/** Whether something narrows the list besides the month. */
export function hasFilters(filters: HistoryFilters): boolean {
  return Boolean(
    filters.type ||
    filters.accountId ||
    filters.categoryId ||
    filters.search ||
    hasRange(filters),
  );
}

/** How many filters hide behind the "Filtros" button (account, category, range). */
export function moreFiltersCount(filters: HistoryFilters): number {
  return [filters.accountId, filters.categoryId, hasRange(filters)].filter(
    Boolean,
  ).length;
}

/** The same filters on another month (any range is dropped). */
export function withPeriod(
  filters: HistoryFilters,
  period: HistoryPeriod,
): HistoryFilters {
  const next: HistoryFilters = { ...filters, period };
  delete next.from;
  delete next.to;
  return next;
}

/** Previous/next month (never a future one); null outside month mode. */
export function monthLinks(
  filters: HistoryFilters,
  today: DayKey = todayKey(),
): { prev: MonthRef; next: MonthRef | null } | null {
  const month = shownMonth(filters);
  if (!month) return null;
  const current = monthOf(today);
  const next = shiftMonth(month, 1);
  const isFuture =
    next.year > current.year ||
    (next.year === current.year && next.month > current.month);
  return { prev: shiftMonth(month, -1), next: isFuture ? null : next };
}

/** The API's TransactionFilters. Days are whole UTC days, like its reports. */
export function toApiFilters(filters: HistoryFilters): Record<string, string> {
  const month = shownMonth(filters);
  const from = filters.from ?? (month ? firstDayOf(month) : undefined);
  const to = filters.to ?? (month ? lastDayOf(month) : undefined);
  return {
    ...(filters.type && { type: filters.type }),
    ...(filters.accountId && { accountId: filters.accountId }),
    ...(filters.categoryId && { categoryId: filters.categoryId }),
    ...(from && { startDate: startOfDayIso(from) }),
    ...(to && { endDate: endOfDayIso(to) }),
    ...(filters.search && { search: filters.search }),
  };
}
