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
} from '../finance/dates';

/**
 * History filters. They live in the URL (?type=expense&account=a,b&month=…),
 * so a filtered view can be shared or reloaded, and the server renders the
 * first page already filtered. The list goes month by month (this month
 * when the URL says nothing); `month=all` shows the whole history, and a
 * `from`/`to` range replaces the month.
 */
export type HistoryType = 'income' | 'expense' | 'transfer';

/** A month, or the whole history. */
export type HistoryPeriod = MonthRef | 'all';

/** The category filter's "Sin categoría" (in `categoryIds` and the URL). */
export const UNCATEGORIZED = 'none';

export interface HistoryFilters {
  type?: HistoryType;
  /** Any of these accounts (none: every account). */
  accountIds?: string[];
  /** Any of these categories, `UNCATEGORIZED` included (none: every one). */
  categoryIds?: string[];
  from?: DayKey;
  to?: DayKey;
  search?: string;
  /** Only movements shown with this automatic name (alias rule). */
  aliasId?: string;
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

/** Ids from `a,b` or repeated params, valid and without repeats (at most 100). */
function ids(value: string | string[] | undefined): string[] | undefined {
  const raw = (Array.isArray(value) ? value : [value ?? ''])
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter((v) => ID.test(v));
  const unique = [...new Set(raw)].slice(0, 100);
  return unique.length ? unique : undefined;
}

export function parseHistoryFilters(
  params: Params,
  today: DayKey = todayKey(),
): HistoryFilters {
  const type = one(params.type);
  const accountIds = ids(params.account);
  const categoryIds = ids(params.category);
  const from = one(params.from);
  const to = one(params.to);
  const search = one(params.q)?.slice(0, 100);
  const month = one(params.month);
  const aliasId = one(params.alias);
  return {
    ...(type && TYPE_OPTIONS.some((o) => o === type && type !== 'all')
      ? { type: type as HistoryType }
      : {}),
    ...(accountIds ? { accountIds } : {}),
    ...(categoryIds ? { categoryIds } : {}),
    ...(isDayKey(from) ? { from } : {}),
    ...(isDayKey(to) ? { to } : {}),
    ...(search ? { search } : {}),
    ...(aliasId && ID.test(aliasId) ? { aliasId } : {}),
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
  if (filters.accountIds?.length) {
    params.set('account', filters.accountIds.join(','));
  }
  if (filters.categoryIds?.length) {
    params.set('category', filters.categoryIds.join(','));
  }
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.search) params.set('q', filters.search);
  if (filters.aliasId) params.set('alias', filters.aliasId);
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
    filters.accountIds?.length ||
    filters.categoryIds?.length ||
    filters.search ||
    filters.aliasId ||
    hasRange(filters),
  );
}

/**
 * The number on the "Filtros" button: each account and category chosen,
 * the type, and the dates (a range or the whole history).
 */
export function activeFilterCount(filters: HistoryFilters): number {
  return (
    (filters.accountIds?.length ?? 0) +
    (filters.categoryIds?.length ?? 0) +
    Number(Boolean(filters.type)) +
    Number(hasRange(filters) || filters.period === 'all')
  );
}

/** Adds or removes one value of a multiple choice (none left: undefined). */
export function toggleValue(
  list: ReadonlyArray<string> | undefined,
  value: string,
  on: boolean,
): string[] | undefined {
  const next = on
    ? [...new Set([...(list ?? []), value])]
    : (list ?? []).filter((v) => v !== value);
  return next.length ? next : undefined;
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

/** What the API's TransactionFilters receives from the history. */
export interface ApiHistoryFilters {
  type?: HistoryType;
  accountIds?: string[];
  categoryIds?: string[];
  includeUncategorized?: boolean;
  startDate?: string;
  endDate?: string;
  search?: string;
  aliasId?: string;
}

/** The API's TransactionFilters. Days are whole UTC days, like its reports. */
export function toApiFilters(filters: HistoryFilters): ApiHistoryFilters {
  const month = shownMonth(filters);
  const from = filters.from ?? (month ? firstDayOf(month) : undefined);
  const to = filters.to ?? (month ? lastDayOf(month) : undefined);
  const categoryIds = (filters.categoryIds ?? []).filter(
    (id) => id !== UNCATEGORIZED,
  );
  return {
    ...(filters.type && { type: filters.type }),
    ...(filters.accountIds?.length && { accountIds: filters.accountIds }),
    ...(categoryIds.length && { categoryIds }),
    ...(filters.categoryIds?.includes(UNCATEGORIZED) && {
      includeUncategorized: true,
    }),
    ...(from && { startDate: startOfDayIso(from) }),
    ...(to && { endDate: endOfDayIso(to) }),
    ...(filters.search && { search: filters.search }),
    ...(filters.aliasId && { aliasId: filters.aliasId }),
  };
}
