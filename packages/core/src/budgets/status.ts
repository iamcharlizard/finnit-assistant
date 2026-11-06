/**
 * How full a budget or a category cap is: fine below 80%, a warning from
 * 80%, over at 100% (the limit is reached or passed), as the API's alerts.
 */
export type CapStatus = 'ok' | 'warning' | 'over';

export const WARNING_RATIO = 0.8;

export function capStatus(spent: number, budgeted: number): CapStatus {
  if (!(budgeted > 0)) return spent > 0 ? 'over' : 'ok';
  const ratio = spent / budgeted;
  if (ratio >= 1) return 'over';
  if (ratio >= WARNING_RATIO) return 'warning';
  return 'ok';
}

/** Whole percent used, not capped at 100 (a cap of 0 with spending is 100). */
export function usedPercent(spent: number, budgeted: number): number {
  if (!(budgeted > 0)) return spent > 0 ? 100 : 0;
  return Math.round((spent / budgeted) * 100);
}

/** Bar colors per status, as CSS colors (theme tokens). */
export const STATUS_COLORS: Record<CapStatus, string> = {
  ok: 'var(--income)',
  warning: '#f59e0b',
  over: 'var(--expense)',
};
