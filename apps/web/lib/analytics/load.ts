import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { getLocalizer } from '@/lib/i18n/server';
import { monthOf, todayKey, type MonthRef } from '@finnit/core/finance/dates';
import {
  PROJECTION_MONTHS,
  analyticsData,
  analyticsQuery,
  type AnalyticsResult,
} from '@finnit/core/analytics/request';
import { buildAnalyticsView, type AnalyticsView } from '@finnit/core/analytics/view';

/** Current month (Mexico City), the latest one analytics can show. */
export function currentMonth(): MonthRef {
  return monthOf(todayKey());
}

/** Six monthly reports, categories and the cash-flow projection in one request. */
export async function loadAnalytics(
  selected: MonthRef,
): Promise<AnalyticsView> {
  const l = await getLocalizer();
  const data = await serverGraphql<AnalyticsResult>(analyticsQuery(selected), {
    monthsAhead: PROJECTION_MONTHS,
  });

  return buildAnalyticsView(analyticsData(data, selected), { selected, current: currentMonth() }, l);
}
