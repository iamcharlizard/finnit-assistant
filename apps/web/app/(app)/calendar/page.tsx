import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { CalendarScreen } from '@/components/screens/calendar-screen';
import { todayKey } from '@finnit/core/finance/dates';
import { loadCalendar } from '@/lib/calendar/load';
import { parseDateParam, parseViewParam } from '@finnit/core/recurring/range';
import { CALENDAR_TABS, parseTab } from '@finnit/core/recurring/tabs';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.calendar') };
}

export default async function CalendarPage({
  searchParams,
}: PageProps<'/calendar'>) {
  // ?month= comes from old links.
  const { view, date, month, tab } = await searchParams;
  return (
    <CalendarScreen
      data={await loadCalendar({
        view: parseViewParam(view),
        date: parseDateParam({ date, month }, todayKey()),
      })}
      initialTab={parseTab(CALENDAR_TABS, tab)}
    />
  );
}
