import {
  endOfDayIso,
  firstDayOf,
  formatMonthParam,
  lastDayOf,
  monthOf,
  parseMonthParam,
  sameMonth,
  shiftMonth,
  startOfDayIso,
  type DayKey,
  type MonthRef,
} from '@/lib/finance/dates';

/**
 * "Clasificar movimientos" filters, kept in the URL
 * (?show=suggested&account=…&month=2026-09|all) so the server renders the
 * first page already filtered.
 */
export type CategorizeShow = 'uncategorized' | 'suggested' | 'all';

export const SHOW_OPTIONS: ReadonlyArray<CategorizeShow> = [
  'uncategorized',
  'suggested',
  'all',
];

/** A month, or every month ('all'). */
export type CategorizePeriod = MonthRef | 'all';

export interface CategorizeFilters {
  show: CategorizeShow;
  accountId?: string;
  period: CategorizePeriod;
}

export const CATEGORIZE_PAGE_SIZE = 30;
/** The API's largest page; "refresh" reloads at most this many rows. */
export const MAX_PAGE_SIZE = 100;

type Params = Record<string, string | string[] | undefined>;

const ID = /^[\w-]{1,64}$/;

const one = (value: string | string[] | undefined) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export function parseCategorizeFilters(
  params: Params,
  today: DayKey,
): CategorizeFilters {
  const show = one(params.show);
  const accountId = one(params.account);
  const month = one(params.month);
  return {
    show: SHOW_OPTIONS.find((o) => o === show) ?? 'uncategorized',
    ...(accountId && ID.test(accountId) ? { accountId } : {}),
    period: month === 'all' ? 'all' : parseMonthParam(month, monthOf(today)),
  };
}

/** The URL query for some filters; defaults (uncategorized, this month) are left out. */
export function categorizeQuery(
  filters: CategorizeFilters,
  today: DayKey,
): string {
  const params = new URLSearchParams();
  if (filters.show !== 'uncategorized') params.set('show', filters.show);
  if (filters.accountId) params.set('account', filters.accountId);
  if (filters.period === 'all') params.set('month', 'all');
  else if (!sameMonth(filters.period, monthOf(today))) {
    params.set('month', formatMonthParam(filters.period));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function categorizeHref(
  filters: CategorizeFilters,
  today: DayKey,
): string {
  return `/transactions/categorize${categorizeQuery(filters, today)}`;
}

/** Previous/next month links for the month switcher (no future months). */
export function periodLinks(
  filters: CategorizeFilters,
  today: DayKey,
): { prevHref: string; nextHref: string | null } | null {
  if (filters.period === 'all') return null;
  const current = monthOf(today);
  const next = shiftMonth(filters.period, 1);
  const isFuture =
    next.year > current.year ||
    (next.year === current.year && next.month > current.month);
  return {
    prevHref: categorizeHref(
      { ...filters, period: shiftMonth(filters.period, -1) },
      today,
    ),
    nextHref: isFuture
      ? null
      : categorizeHref({ ...filters, period: next }, today),
  };
}

export type ApiTransactionFilters = {
  accountId?: string;
  startDate?: string;
  endDate?: string;
  uncategorized?: boolean;
  hasSuggestion?: boolean;
};

/** The API's TransactionFilters. Months are whole UTC days, like its reports. */
export function toApiFilters(
  filters: CategorizeFilters,
): ApiTransactionFilters {
  return {
    ...(filters.accountId && { accountId: filters.accountId }),
    ...(filters.period !== 'all' && {
      startDate: startOfDayIso(firstDayOf(filters.period)),
      endDate: endOfDayIso(lastDayOf(filters.period)),
    }),
    ...(filters.show === 'uncategorized' && { uncategorized: true }),
    ...(filters.show === 'suggested' && { hasSuggestion: true }),
  };
}

/** Variables of the page query: the first page, the next one, or a reload. */
export function pageVariables(
  filters: CategorizeFilters,
  { after = null, loaded = 0 }: { after?: string | null; loaded?: number } = {},
): { first: number; after: string | null; filters: ApiTransactionFilters } {
  return {
    // A reload asks again for what is on screen, within the API's limit.
    first: Math.min(Math.max(loaded, CATEGORIZE_PAGE_SIZE), MAX_PAGE_SIZE),
    after,
    filters: toApiFilters(filters),
  };
}
