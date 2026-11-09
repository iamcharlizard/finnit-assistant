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
 * History filters. They live in the URL (?type=expense,income&account=a,b
 * &month=…), so a filtered view can be shared or reloaded, and the server
 * renders the first page already filtered. The list goes month by month
 * (this month when the URL says nothing); `month=all` shows the whole
 * history, and a `from`/`to` range replaces the month.
 *
 * Accounts, categories and types are selections: absent means everything
 * (every box checked), a list means only those, and an empty list (`-` in
 * the URL) means none, so nothing is shown.
 */
export type HistoryType = 'income' | 'expense' | 'transfer';

/** A month, or the whole history. */
export type HistoryPeriod = MonthRef | 'all';

/** The category filter's "Sin categoría" (in `categoryIds` and the URL). */
export const UNCATEGORIZED = 'none';

/** An empty selection in the URL (every box unchecked). */
export const NONE_SELECTED = '-';

export interface HistoryFilters {
  /** Any of these types (absent: every type). */
  types?: HistoryType[];
  /** Any of these accounts (absent: every account). */
  accountIds?: string[];
  /**
   * Expenses in any of these categories, `UNCATEGORIZED` included (absent:
   * every one). The options are expense categories, so narrowing them shows
   * expenses only: no income, transfers or adjustments.
   */
  categoryIds?: string[];
  /**
   * "Por clasificar": only income and expenses without a category that can
   * take one (what Clasificar used to list). The category filter is ignored.
   */
  review?: boolean;
  from?: DayKey;
  to?: DayKey;
  search?: string;
  /** Only movements shown with this automatic name (alias rule). */
  aliasId?: string;
  /** Ignored while a from/to range is set. */
  period: HistoryPeriod;
}

export const HISTORY_PAGE_SIZE = 30;
/** The most rows a reload brings back at once (the API's largest page). */
export const HISTORY_MAX_SHOWN = 200;
/** The URL key of how many rows are loaded (`?n=90`). */
export const SHOWN_PARAM = 'n';

/**
 * How many rows the list had loaded (`?n=`), so a reload (after editing a
 * movement, or the browser's) brings them all back instead of the first
 * page. Not a filter: changing it never starts the list over.
 */
export function parseShown(params: Params): number {
  const raw = params[SHOWN_PARAM];
  const value = Number.parseInt(typeof raw === 'string' ? raw : '', 10);
  if (!Number.isFinite(value)) return HISTORY_PAGE_SIZE;
  return Math.min(HISTORY_MAX_SHOWN, Math.max(HISTORY_PAGE_SIZE, value));
}

/** The `n` to keep in the URL for this many rows (none for the first page). */
export function shownParam(rows: number): string | null {
  return rows > HISTORY_PAGE_SIZE
    ? String(Math.min(HISTORY_MAX_SHOWN, rows))
    : null;
}

/** The types, in order; labels are `history.types.<value>`. */
export const HISTORY_TYPES: ReadonlyArray<HistoryType> = [
  'income',
  'expense',
  'transfer',
];

type Params = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const ID = /^[\w-]{1,64}$/;

/**
 * A selection from `a,b` or repeated params: valid ids without repeats (at
 * most 500); `-` is an empty selection, nothing valid is no selection.
 */
function ids(value: string | string[] | undefined): string[] | undefined {
  const parts = (Array.isArray(value) ? value : [value ?? ''])
    .flatMap((v) => v.split(','))
    .map((v) => v.trim());
  if (parts.length === 1 && parts[0] === NONE_SELECTED) return [];
  const raw = parts.filter((v) => v !== NONE_SELECTED && ID.test(v));
  const unique = [...new Set(raw)].slice(0, 500);
  return unique.length ? unique : undefined;
}

/** A selection as a URL value (`-` when empty). */
export const selectionParam = (list: ReadonlyArray<string>) =>
  list.length ? list.join(',') : NONE_SELECTED;

export function parseHistoryFilters(
  params: Params,
  today: DayKey = todayKey(),
): HistoryFilters {
  const rawTypes = ids(params.type);
  const validTypes = rawTypes?.filter((v): v is HistoryType =>
    HISTORY_TYPES.includes(v as HistoryType),
  );
  // `-` is no type; only unknown values (an old `type=all`) are no filter.
  const types =
    rawTypes && (rawTypes.length === 0 || validTypes?.length)
      ? validTypes
      : undefined;
  const accountIds = ids(params.account);
  const categoryIds = ids(params.category);
  const from = one(params.from);
  const to = one(params.to);
  const search = one(params.q)?.slice(0, 100);
  const month = one(params.month);
  const aliasId = one(params.alias);
  const review = one(params.review) === '1';
  return {
    ...(types && types.length < HISTORY_TYPES.length ? { types } : {}),
    ...(accountIds ? { accountIds } : {}),
    ...(categoryIds ? { categoryIds } : {}),
    ...(isDayKey(from) ? { from } : {}),
    ...(isDayKey(to) ? { to } : {}),
    ...(search ? { search } : {}),
    ...(aliasId && ID.test(aliasId) ? { aliasId } : {}),
    ...(review ? { review } : {}),
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
  if (filters.types) params.set('type', selectionParam(filters.types));
  if (filters.accountIds) {
    params.set('account', selectionParam(filters.accountIds));
  }
  if (filters.categoryIds) {
    params.set('category', selectionParam(filters.categoryIds));
  }
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.search) params.set('q', filters.search);
  if (filters.aliasId) params.set('alias', filters.aliasId);
  if (filters.review) params.set('review', '1');
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
    filters.types ||
    filters.accountIds ||
    filters.categoryIds ||
    filters.search ||
    filters.aliasId ||
    filters.review ||
    hasRange(filters),
  );
}

/**
 * The number on the "Filtros" button: one per group that narrows the list
 * (accounts, categories, types, and the dates when a range or the whole
 * history).
 */
export function activeFilterCount(filters: HistoryFilters): number {
  return (
    Number(Boolean(filters.accountIds)) +
    Number(Boolean(filters.categoryIds)) +
    Number(Boolean(filters.types)) +
    Number(hasRange(filters) || filters.period === 'all')
  );
}

/** Whether a value is checked in a selection (absent: all are). */
export function isSelected(
  list: ReadonlyArray<string> | undefined,
  value: string,
): boolean {
  return !list || list.includes(value);
}

/**
 * Checks or unchecks some values of a selection over `all`; checking the
 * last missing one gives back "everything" (undefined).
 */
export function selectValues<T extends string>(
  list: ReadonlyArray<T> | undefined,
  values: ReadonlyArray<T>,
  on: boolean,
  all: ReadonlyArray<T>,
): T[] | undefined {
  const current = new Set<T>(list ?? all);
  for (const value of values) {
    if (on) current.add(value);
    else current.delete(value);
  }
  const next = all.filter((value) => current.has(value));
  return next.length === all.length ? undefined : next;
}

/** A category option, with its parent for subcategories. */
export interface CategoryChoice {
  value: string;
  parentId?: string;
}

/** How a category's box shows: a parent is mixed when only some of its family is. */
export function categoryCheck(
  list: ReadonlyArray<string> | undefined,
  option: CategoryChoice,
  options: ReadonlyArray<CategoryChoice>,
): boolean | 'indeterminate' {
  if (isSelected(list, option.value)) return true;
  if (option.parentId) return false;
  const children = options.filter((o) => o.parentId === option.value);
  return children.some((child) => isSelected(list, child.value))
    ? 'indeterminate'
    : false;
}

/**
 * Checks or unchecks a category. A parent takes its subcategories with it,
 * and stays checked only while all of them are (so choosing it, which the
 * API expands to its subcategories, never brings back an unchecked one).
 */
export function selectCategory(
  list: ReadonlyArray<string> | undefined,
  option: CategoryChoice,
  on: boolean,
  options: ReadonlyArray<CategoryChoice>,
): string[] | undefined {
  const all = options.map((o) => o.value);
  const family = (parent: string) => [
    parent,
    ...options.filter((o) => o.parentId === parent).map((o) => o.value),
  ];
  if (!option.parentId) {
    return selectValues(list, family(option.value), on, all);
  }
  const parent = option.parentId;
  let next = selectValues(list, [option.value], on, all);
  const siblings = family(parent).slice(1);
  const complete = siblings.every((id) => isSelected(next, id));
  next = selectValues(next, [parent], complete, all);
  return next;
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
  types?: HistoryType[];
  accountIds?: string[];
  categoryIds?: string[];
  includeUncategorized?: boolean;
  /** No category at all ("Por clasificar"). */
  uncategorized?: boolean;
  /** Only movements that can take a category (income and expenses). */
  categorizable?: boolean;
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
  // Empty lists go as they are: the API shows nothing for them.
  const narrowed = !filters.review && filters.categoryIds;
  // Possible transfers waiting for an answer aren't spending either.
  const categories = narrowed && {
    categoryIds: narrowed.filter((id) => id !== UNCATEGORIZED),
    includeUncategorized: narrowed.includes(UNCATEGORIZED),
    categorizable: true,
  };
  // Categories are expense categories: narrowing them leaves expenses only.
  const types = narrowed
    ? (filters.types ?? HISTORY_TYPES).filter((t) => t === 'expense')
    : filters.types;
  return {
    ...(types && { types }),
    ...(filters.accountIds && { accountIds: filters.accountIds }),
    ...categories,
    ...(from && { startDate: startOfDayIso(from) }),
    ...(to && { endDate: endOfDayIso(to) }),
    ...(filters.search && { search: filters.search }),
    ...(filters.aliasId && { aliasId: filters.aliasId }),
    ...(filters.review && { uncategorized: true, categorizable: true }),
  };
}
