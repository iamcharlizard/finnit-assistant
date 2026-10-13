import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RecurringScreen } from '@/components/screens/recurring-screen';
import { todayKey } from '@/lib/finance/dates';
import { loadRecurring } from '@/lib/recurring/load';
import { parseDateParam, parseViewParam } from '@/lib/recurring/range';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.recurring') };
}

export default async function RecurringPage({
  searchParams,
}: PageProps<'/recurring'>) {
  // ?month= comes from the old /calendar links.
  const { view, date, month } = await searchParams;
  const parsedView = parseViewParam(view);
  const parsedDate = parseDateParam({ date, month }, todayKey());
  return (
    <RecurringScreen
      data={await loadRecurring({ view: parsedView, date: parsedDate })}
    />
  );
}
