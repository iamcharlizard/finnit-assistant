import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { getLocalizer } from '@/lib/i18n/server';
import { monthOf, todayKey } from '@finnit/core/finance/dates';
import {
  DASHBOARD_QUERY,
  dashboardData,
  dashboardVariables,
  type DashboardResult,
} from '@finnit/core/dashboard/request';
import { buildDashboardView, type DashboardView } from '@finnit/core/dashboard/view';

/** Everything the dashboard shows, in one request. */
export async function loadDashboard(): Promise<DashboardView> {
  const today = todayKey();
  const [data, l] = await Promise.all([
    serverGraphql<DashboardResult>(DASHBOARD_QUERY, dashboardVariables(today)),
    getLocalizer(),
  ]);
  return buildDashboardView(dashboardData(data), { today, month: monthOf(today) }, l);
}
