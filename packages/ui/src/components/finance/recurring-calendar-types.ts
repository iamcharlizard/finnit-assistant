import {
  BellIcon,
  CheckIcon,
  CircleAlertIcon,
  type LucideIcon,
} from 'lucide-react';

type RecurringCalendarView = 'day' | 'week' | 'month';
type RecurringEventStatus =
  | 'upcoming'
  | 'paid'
  | 'skipped'
  | 'missed'
  | 'reminder';
type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface RecurringCalendarEvent {
  id: string;
  /** 'YYYY-MM-DD'. */
  date: string;
  title: string;
  /** Already formatted amount, e.g. "$1,250.00". */
  amountLabel?: string;
  status: RecurringEventStatus;
  /** Accent color (any CSS color); decorative, used for the stripe/dot. */
  color?: string;
}

interface RecurringCalendarLabels {
  views: Record<RecurringCalendarView, string>;
  viewSwitcher: string;
  today: string;
  previous: string;
  next: string;
  /** January … December. */
  months: string[];
  /** Sunday … Saturday (index = Date#getDay()). */
  weekdays: string[];
  /** Sun … Sat. */
  weekdaysShort: string[];
  /** S … S, used on narrow screens. */
  weekdaysNarrow: string[];
  status: Record<RecurringEventStatus, string>;
  /** "+2" chip in the month grid; also used for its accessible text. */
  more: (count: number) => string;
  /** Accessible summary of a day cell, e.g. "3 payments". */
  eventCount: (count: number) => string;
  noEvents: string;
}

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
