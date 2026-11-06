import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { getLocalizer } from '@/lib/i18n/server';
import { todayKey } from '@finnit/core/finance/dates';
import type { RecurringView } from '@finnit/core/recurring/range';
import {
  RECURRING_QUERY,
  recurringData,
  recurringVariables,
  type RecurringResult,
} from '@finnit/core/recurring/request';
import { buildRecurringView, type RecurringScreenView } from '@finnit/core/recurring/view';

/**
 * The visible period's payments, every recurring expense (active and
 * paused) and what the dialog's pickers need, in one request. Suggestions
 * load in the browser: they may take seconds the first time (AI).
 */
export async function loadRecurring({
  view,
  date,
}: {
  view: RecurringView;
  date: string;
}): Promise<RecurringScreenView> {
  const [data, l] = await Promise.all([
    serverGraphql<RecurringResult>(RECURRING_QUERY, recurringVariables(view, date)),
    getLocalizer(),
  ]);
  return buildRecurringView(recurringData(data), { view, date, today: todayKey() }, l);
}
