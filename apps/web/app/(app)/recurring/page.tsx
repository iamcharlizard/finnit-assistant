import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RecurringScreen } from '@/components/screens/recurring-screen';
import { todayKey } from '@finnit/core/finance/dates';
import { loadRecurring } from '@/lib/recurring/load';
import { parseExpenseFilters } from '@finnit/core/recurring/filters';
import { parseTabParam } from '@finnit/core/recurring/tabs';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.recurring') };
}

export default async function RecurringPage({
  searchParams,
}: PageProps<'/recurring'>) {
  // Old links to the calendar (?view=, ?date=, ?tab=calendar) are
  // redirected to /calendar in next.config.ts.
  const params = await searchParams;
  return (
    <RecurringScreen
      data={await loadRecurring({ view: 'month', date: todayKey() })}
      initialTab={parseTabParam(params.tab)}
      initialFilters={parseExpenseFilters(params)}
    />
  );
}
