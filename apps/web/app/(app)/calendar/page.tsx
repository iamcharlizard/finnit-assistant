import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { CalendarScreen } from '@/components/screens/calendar-screen';
import { loadCalendar } from '@/lib/calendar/load';
import {
  formatMonthParam,
  monthOf,
  parseMonthParam,
  todayKey,
} from '@/lib/finance/dates';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.recurring') };
}

export default async function CalendarPage({
  searchParams,
}: PageProps<'/calendar'>) {
  const month = parseMonthParam(
    (await searchParams).month,
    monthOf(todayKey()),
  );
  return (
    // A new month starts with its own selection.
    <CalendarScreen
      key={formatMonthParam(month)}
      view={await loadCalendar(month)}
    />
  );
}
