import type { CalendarEvent } from '@finnit/ui/components/finance/calendar-day-cell';

// TODO: replace with GraphQL (debts/budgets payments).
// Copied from apps/finnit-app/screens/calendar.tsx.

export const CALENDAR_MONTH = {
  label: 'Octubre 2023',
  leadingDays: [25, 26, 27, 28, 29, 30],
  daysInMonth: 28,
  today: 12,
};

export const CALENDAR_EVENTS: Partial<Record<number, CalendarEvent>> = {
  3: { label: 'Alquiler', accent: 'primary' },
  10: { label: 'Seguro', accent: 'neon' },
};
