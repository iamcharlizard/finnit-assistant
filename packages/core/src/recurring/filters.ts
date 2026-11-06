import type { RecurringKind } from '../finance/types';
import { RECURRING_KINDS } from './types';
import { dayKeyOf } from '../finance/dates';
import { normalizeSearch } from '../text/option-search';
import type { ExpenseItem } from './view';

/** Filters of "Mis pagos recurrentes". */
export type StatusFilter = 'active' | 'paused' | 'all';

/** The kinds the user has, in the app's order. */
export function kindFilterOptions(
  expenses: ReadonlyArray<Pick<ExpenseItem, 'kind'>>,
): RecurringKind[] {
  const present = new Set(expenses.map((e) => e.kind));
  return RECURRING_KINDS.filter((kind) => present.has(kind));
}

export function filterExpenses<T extends Pick<ExpenseItem, 'kind' | 'active'>>(
  expenses: ReadonlyArray<T>,
  { kind, status }: { kind: string; status: StatusFilter },
): T[] {
  return expenses.filter(
    (e) =>
      (kind === 'all' || e.kind === kind) &&
      (status === 'all' || e.active === (status === 'active')),
  );
}

// ---------------------------------------------------------------------------
// The filter bar of "Pagos recurrentes" (kept in the URL)
// ---------------------------------------------------------------------------

export const EXPENSE_SORTS = ['next', 'amount', 'name'] as const;
export type ExpenseSort = (typeof EXPENSE_SORTS)[number];
export const STATUS_FILTERS = ['active', 'paused', 'all'] as const;

export interface ExpenseFilters {
  /** Name, account or category. */
  q: string;
  status: StatusFilter;
  /** Empty: every kind. */
  kinds: RecurringKind[];
  /** Account ids; NO_ACCOUNT for expenses without one. Empty: every one. */
  accounts: string[];
  sort: ExpenseSort;
}

/** The "Sin cuenta" option of the account filter. */
export const NO_ACCOUNT = 'none';

export const DEFAULT_EXPENSE_FILTERS: ExpenseFilters = {
  q: '',
  status: 'active',
  kinds: [],
  accounts: [],
  sort: 'next',
};

type Params = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined;
const list = (value: string | string[] | undefined) =>
  (one(value) ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

/** `?q=&status=&kind=a,b&account=x,y&sort=` → filters; unknown values are dropped. */
export function parseExpenseFilters(params: Params): ExpenseFilters {
  const status = one(params.status);
  const sort = one(params.sort);
  return {
    q: (one(params.q) ?? '').slice(0, 80),
    status: (STATUS_FILTERS as readonly string[]).includes(status ?? '')
      ? (status as StatusFilter)
      : DEFAULT_EXPENSE_FILTERS.status,
    kinds: [
      ...new Set(
        list(params.kind).filter((k): k is RecurringKind =>
          (RECURRING_KINDS as readonly string[]).includes(k),
        ),
      ),
    ],
    accounts: [...new Set(list(params.account))],
    sort: (EXPENSE_SORTS as readonly string[]).includes(sort ?? '')
      ? (sort as ExpenseSort)
      : DEFAULT_EXPENSE_FILTERS.sort,
  };
}

/** `search` with the filters set (defaults left out); other params stay. */
export function withExpenseFilters(
  search: string,
  filters: ExpenseFilters,
): string {
  const params = new URLSearchParams(search);
  const set = (key: string, value: string, fallback: string) => {
    if (value && value !== fallback) params.set(key, value);
    else params.delete(key);
  };
  set('q', filters.q.trim(), '');
  set('status', filters.status, DEFAULT_EXPENSE_FILTERS.status);
  set('kind', filters.kinds.join(','), '');
  set('account', filters.accounts.join(','), '');
  set('sort', filters.sort, DEFAULT_EXPENSE_FILTERS.sort);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** How many filters differ from the defaults (search and sort aside). */
export function activeFilterCount(filters: ExpenseFilters): number {
  return (
    Number(filters.status !== DEFAULT_EXPENSE_FILTERS.status) +
    filters.kinds.length +
    filters.accounts.length
  );
}

type FilterableExpense = Pick<
  ExpenseItem,
  | 'id'
  | 'name'
  | 'kind'
  | 'active'
  | 'monthlyCost'
  | 'accountLabel'
  | 'categoryLabel'
> & { expense: { accountId: string | null; nextDueDate: string | null } };

/** Options of a multi-choice filter, with how many expenses each has. */
export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
  count: number;
}

/** The kinds the user has, in the app's order, with their counts. */
export function kindOptions(
  expenses: ReadonlyArray<FilterableExpense>,
  label: (kind: RecurringKind) => string,
): FilterOption<RecurringKind>[] {
  return kindFilterOptions(expenses).map((kind) => ({
    value: kind,
    label: label(kind),
    count: expenses.filter((e) => e.kind === kind).length,
  }));
}

/** The accounts the expenses are paid from, by name; "Sin cuenta" last. */
export function accountOptions(
  expenses: ReadonlyArray<FilterableExpense>,
  noAccountLabel: string,
  locale: string,
): FilterOption[] {
  const byId = new Map<string, FilterOption>();
  for (const e of expenses) {
    const id = e.expense.accountId ?? NO_ACCOUNT;
    const current = byId.get(id);
    if (current) current.count += 1;
    else {
      byId.set(id, {
        value: id,
        label: e.expense.accountId
          ? (e.accountLabel ?? noAccountLabel)
          : noAccountLabel,
        count: 1,
      });
    }
  }
  return [...byId.values()].sort(
    (a, b) =>
      Number(a.value === NO_ACCOUNT) - Number(b.value === NO_ACCOUNT) ||
      a.label.localeCompare(b.label, locale),
  );
}

/** The expenses that pass the filters, in the chosen order. */
export function applyExpenseFilters<T extends FilterableExpense>(
  expenses: ReadonlyArray<T>,
  filters: ExpenseFilters,
  locale: string,
): T[] {
  const query = normalizeSearch(filters.q);
  const kinds = new Set(filters.kinds);
  const accounts = new Set(filters.accounts);
  const shown = expenses.filter((e) => {
    if (filters.status !== 'all' && e.active !== (filters.status === 'active'))
      return false;
    if (kinds.size && !kinds.has(e.kind)) return false;
    if (accounts.size && !accounts.has(e.expense.accountId ?? NO_ACCOUNT))
      return false;
    if (!query) return true;
    return [e.name, e.accountLabel, e.categoryLabel].some(
      (text) => text && normalizeSearch(text).includes(query),
    );
  });
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, locale);
  const next = (e: T) =>
    e.active && e.expense.nextDueDate ? dayKeyOf(e.expense.nextDueDate) : null;
  return shown.sort((a, b) => {
    if (filters.sort === 'amount')
      return b.monthlyCost - a.monthlyCost || byName(a, b);
    if (filters.sort === 'name') return byName(a, b);
    const na = next(a);
    const nb = next(b);
    if (na === nb) return byName(a, b);
    if (na === null) return 1;
    if (nb === null) return -1;
    return na.localeCompare(nb);
  });
}
