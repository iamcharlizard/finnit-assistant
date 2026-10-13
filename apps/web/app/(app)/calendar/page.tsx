import type { Metadata } from 'next';

import { CalendarScreen } from '@/components/screens/calendar-screen';
import { loadCalendar } from '@/lib/calendar/load';
import {
  formatMonthParam,
  monthOf,
  parseMonthParam,
  todayKey,
} from '@/lib/finance/dates';

export const metadata: Metadata = { title: 'Calendario' };

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
