import {
  BellIcon,
  CheckIcon,
  CircleAlertIcon,
  type LucideIcon,
} from 'lucide-react';

import type {
  RecurringCalendarEvent,
  RecurringCalendarLabels,
  RecurringCalendarView,
  RecurringEventStatus,
  WeekDay,
} from '@finnit/core/ui/recurring-calendar';

const DEFAULT_RECURRING_CALENDAR_LABELS: RecurringCalendarLabels = {
  views: { day: 'Day', week: 'Week', month: 'Month' },
  viewSwitcher: 'Calendar view',
  today: 'Today',
  previous: 'Previous',
  next: 'Next',
  months: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  weekdays: [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ],
  weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  weekdaysNarrow: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  status: {
    upcoming: 'Upcoming',
    paid: 'Paid',
    skipped: 'Skipped',
    missed: 'Missed',
    reminder: 'Reminder',
  },
  more: (count) => `+${count}`,
  eventCount: (count) => (count === 1 ? '1 payment' : `${count} payments`),
  noEvents: 'No payments this day.',
};

const STATUS_STYLE: Record<
  RecurringEventStatus,
  { text: string; icon?: LucideIcon }
> = {
  upcoming: { text: 'text-on-background' },
  paid: { text: 'text-on-background', icon: CheckIcon },
  skipped: { text: 'text-on-surface-variant line-through' },
  missed: { text: 'text-expense', icon: CircleAlertIcon },
  reminder: { text: 'text-on-background', icon: BellIcon },
};

const STATUS_BADGE: Record<RecurringEventStatus, string> = {
  upcoming: 'bg-muted text-on-surface-variant',
  paid: 'bg-income/10 text-income',
  skipped: 'bg-muted text-on-surface-variant',
  missed: 'bg-expense/10 text-expense',
  reminder: 'bg-accent-neon/10 text-violet-ink',
};

const DEFAULT_ACCENT = 'var(--accent-neon)';

export {
  DEFAULT_ACCENT,
  DEFAULT_RECURRING_CALENDAR_LABELS,
  STATUS_BADGE,
  STATUS_STYLE,
  type RecurringCalendarEvent,
  type RecurringCalendarLabels,
  type RecurringCalendarView,
  type RecurringEventStatus,
  type WeekDay,
};
