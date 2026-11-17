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
import {
  buildRecurringView,
  type RecurringScreenView,
} from '@finnit/core/recurring/view';
import {
  buildRecurringAnalytics,
  type RecurringAnalytics,
} from '@finnit/core/recurring/analytics';
import {
  ESSENTIAL_PROFILE_QUERY,
  answersOf,
  type ApiEssentialProfile,
  type EssentialAnswers,
} from '@finnit/core/recurring/essentials';

export interface RecurringPageData extends RecurringScreenView {
  analytics: RecurringAnalytics;
  /** The questionnaire's answers; null until answered. */
  essentialAnswers: EssentialAnswers | null;
}

/**
 * The visible period's payments, every recurring expense (active and
 * paused), what the dialog's pickers need and the analysis (with the
 * questionnaire's answers), in one go. Suggestions
 * load in the browser: they may take seconds the first time (AI).
 */
export async function loadRecurring({
  view,
  date,
}: {
  view: RecurringView;
  date: string;
}): Promise<RecurringPageData> {
  const [data, profile, l] = await Promise.all([
    serverGraphql<RecurringResult>(
      RECURRING_QUERY,
      recurringVariables(view, date, { excludeCardInstallments: true }),
    ),
    serverGraphql<{ recurringEssentialProfile: ApiEssentialProfile | null }>(
      ESSENTIAL_PROFILE_QUERY,
    ).then((d) => d.recurringEssentialProfile),
    getLocalizer(),
  ]);
  const recurring = recurringData(data);
  return {
    ...buildRecurringView(recurring, { view, date, today: todayKey() }, l),
    analytics: buildRecurringAnalytics(recurring, l),
    essentialAnswers: profile ? answersOf(profile) : null,
  };
}
