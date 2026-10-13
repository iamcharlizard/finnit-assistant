'use client';

import { cn } from '../../lib/utils';
import {
  DEFAULT_ACCENT,
  STATUS_BADGE,
  STATUS_STYLE,
  type RecurringCalendarEvent,
  type RecurringCalendarLabels,
} from './recurring-calendar-types';

interface RecurringCalendarDayListProps {
  events: RecurringCalendarEvent[];
  labels: Pick<RecurringCalendarLabels, 'noEvents' | 'status'>;
  onEventClick?: (event: RecurringCalendarEvent) => void;
}

/** Day view of RecurringCalendar: the day's events as a list. */
function RecurringCalendarDayList({
  events,
  labels,
  onEventClick,
}: RecurringCalendarDayListProps) {
  if (events.length === 0) {
    return (
      <p className="rounded-chip bg-muted px-4 py-8 text-center text-sm text-on-surface-variant">
        {labels.noEvents}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {events.map((event) => {
        const style = STATUS_STYLE[event.status];
        const Icon = style.icon;
        const body = (
          <>
            <span
              aria-hidden
              className="h-10 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: event.color ?? DEFAULT_ACCENT }}
            />
            <span className="min-w-0 flex-1">
              <span
                className={cn('block truncate text-sm font-medium', style.text)}
              >
                {event.title}
              </span>
              <span
                className={cn(
                  'mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                  STATUS_BADGE[event.status],
                )}
              >
                {Icon ? <Icon aria-hidden className="size-3" /> : null}
                {labels.status[event.status]}
              </span>
            </span>
            {event.amountLabel ? (
              <span className="shrink-0 text-sm font-bold text-on-background">
                {event.amountLabel}
              </span>
            ) : null}
          </>
        );
        const rowClass =
          'flex min-h-16 w-full items-center gap-3 rounded-2xl border border-outline bg-surface p-3 text-left';
        return (
          <li key={event.id}>
            {onEventClick ? (
              <button
                type="button"
                onClick={() => onEventClick(event)}
                className={cn(
                  rowClass,
                  'outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                )}
              >
                {body}
              </button>
            ) : (
              <div className={rowClass}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export { RecurringCalendarDayList, type RecurringCalendarDayListProps };
