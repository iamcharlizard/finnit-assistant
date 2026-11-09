import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { getLocalizer } from '@/lib/i18n/server';
import { todayKey } from '@finnit/core/finance/dates';
import type { HistoryFilters } from '@finnit/core/history/filters';
import {
  HISTORY_QUERY,
  buildHistoryData,
  historyVariables,
  type HistoryData,
  type HistoryResult,
} from '@finnit/core/history/request';

export type { HistoryData };

/** First page of the filtered history plus what the filters and aside need. */
export async function loadHistory(
  filters: HistoryFilters,
  shown?: number,
): Promise<HistoryData> {
  const today = todayKey();
  const [data, l] = await Promise.all([
    serverGraphql<HistoryResult>(
      HISTORY_QUERY,
      historyVariables(filters, shown),
    ),
    getLocalizer(),
  ]);
  return buildHistoryData(data, filters, today, l);
}
