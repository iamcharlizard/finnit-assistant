import type { RecurringKind } from '@/lib/finance/types';
import { RECURRING_KINDS } from './types';
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
