import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { getLocalizer } from '@/lib/i18n/server';
import { todayKey } from '@finnit/core/finance/dates';
import {
  buildCalendarSummary,
  summaryVariables,
  type CalendarSummary,
} from '@finnit/core/calendar/summary';
import type { RecurringView } from '@finnit/core/recurring/range';
import {
  RECURRING_QUERY,
  recurringData,
  recurringVariables,
  type RecurringResult,
} from '@finnit/core/recurring/request';
import {
  buildRecurringView,
  type RecurringScreenView,
} from '@finnit/core/recurring/view';

export interface CalendarData {
  calendar: RecurringScreenView;
  summary: CalendarSummary;
}

/**
 * The payments calendar: the visible period (month, week or day) and the
 * summary (this month and the next five), in two parallel requests.
 */
export async function loadCalendar({
  view,
  date,
}: {
  view: RecurringView;
  date: string;
}): Promise<CalendarData> {
  const today = todayKey();
  const [period, months, l] = await Promise.all([
    serverGraphql<RecurringResult>(
      RECURRING_QUERY,
      recurringVariables(view, date),
    ),
    serverGraphql<RecurringResult>(RECURRING_QUERY, summaryVariables(today)),
    getLocalizer(),
  ]);
  return {
    calendar: buildRecurringView(
      recurringData(period),
      { view, date, today },
      l,
    ),
    summary: buildCalendarSummary(recurringData(months), today, l),
  };
}
