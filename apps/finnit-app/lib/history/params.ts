import {
  formatMonthParam,
  monthOf,
  sameMonth,
  type DayKey,
} from '@finnit/core/finance/dates';
import {
  hasRange,
  selectionParam,
  type HistoryFilters,
} from '@finnit/core/history/filters';

/**
 * The filters as route params, the same keys as the web's URL
 * (historyQuery): type, account, category, from, to, q, alias, review, month.
 * Unset keys are undefined, so setParams clears them.
 */
export function historyParams(
  filters: HistoryFilters,
  today: DayKey,
): Record<string, string | undefined> {
  return {
    type: filters.types && selectionParam(filters.types),
    account: filters.accountIds && selectionParam(filters.accountIds),
    category: filters.categoryIds && selectionParam(filters.categoryIds),
    from: filters.from,
    to: filters.to,
    q: filters.search,
    alias: filters.aliasId,
    review: filters.review ? '1' : undefined,
    month: hasRange(filters)
      ? undefined
      : filters.period === 'all'
        ? 'all'
        : sameMonth(filters.period, monthOf(today))
          ? undefined
          : formatMonthParam(filters.period),
  };
}
