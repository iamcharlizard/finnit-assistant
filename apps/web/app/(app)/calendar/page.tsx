import type { Metadata } from 'next';

import { CalendarScreen } from '@/components/screens/calendar-screen';

export const metadata: Metadata = { title: 'Calendario' };

export default function CalendarPage() {
  return <CalendarScreen />;
}
