/**
 * Data types of the recurring-payments calendar, shared by the web
 * (`@finnit/ui`) and mobile (`@finnit/ui-native`) components and by the
 * view builders that feed them.
 */
export type RecurringCalendarView = 'day' | 'week' | 'month';

export type RecurringEventStatus =
  | 'upcoming'
  | 'paid'
  | 'skipped'
  | 'missed'
  | 'reminder';

export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface RecurringCalendarEvent {
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

export interface RecurringCalendarLabels {
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
