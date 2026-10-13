import {
  endOfDayIso,
  isDayKey,
  startOfDayIso,
  type DayKey,
} from '@/lib/finance/dates';

/**
 * History filters. They live in the URL (?type=expense&account=…&from=…),
 * so a filtered view can be shared or reloaded, and the server renders the
 * first page already filtered.
 */
export type HistoryType = 'income' | 'expense' | 'transfer';

export interface HistoryFilters {
  type?: HistoryType;
  accountId?: string;
  categoryId?: string;
  from?: DayKey;
  to?: DayKey;
  search?: string;
}

export const HISTORY_PAGE_SIZE = 30;

export const TYPE_OPTIONS: ReadonlyArray<{
  value: HistoryType | 'all';
  label: string;
}> = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expense', label: 'Gastos' },
  { value: 'transfer', label: 'Transferencias' },
];

type Params = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const ID = /^[\w-]{1,64}$/;

export function parseHistoryFilters(params: Params): HistoryFilters {
  const type = one(params.type);
  const accountId = one(params.account);
  const categoryId = one(params.category);
  const from = one(params.from);
  const to = one(params.to);
  const search = one(params.q)?.slice(0, 100);
  return {
    ...(type && TYPE_OPTIONS.some((o) => o.value === type && type !== 'all')
      ? { type: type as HistoryType }
      : {}),
    ...(accountId && ID.test(accountId) ? { accountId } : {}),
    ...(categoryId && ID.test(categoryId) ? { categoryId } : {}),
    ...(isDayKey(from) ? { from } : {}),
    ...(isDayKey(to) ? { to } : {}),
    ...(search ? { search } : {}),
  };
}

/** The URL query for some filters ("" without filters). */
export function historyQuery(filters: HistoryFilters): string {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.accountId) params.set('account', filters.accountId);
  if (filters.categoryId) params.set('category', filters.categoryId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.search) params.set('q', filters.search);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function hasFilters(filters: HistoryFilters): boolean {
  return Object.values(filters).some(Boolean);
}

/** The API's TransactionFilters. Days are whole UTC days, like its reports. */
export function toApiFilters(filters: HistoryFilters): Record<string, string> {
  return {
    ...(filters.type && { type: filters.type }),
    ...(filters.accountId && { accountId: filters.accountId }),
    ...(filters.categoryId && { categoryId: filters.categoryId }),
    ...(filters.from && { startDate: startOfDayIso(filters.from) }),
    ...(filters.to && { endDate: endOfDayIso(filters.to) }),
    ...(filters.search && { search: filters.search }),
  };
}
