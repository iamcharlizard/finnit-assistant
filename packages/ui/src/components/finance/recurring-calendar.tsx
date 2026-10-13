'use client';

import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import {
  addDaysToDateOnly,
  parseDateOnly,
  toDateOnly,
} from '../../lib/date-only';
import { cn } from '../../lib/utils';
import { RecurringCalendarDayList } from './recurring-calendar-day-list';
import { RecurringCalendarEventChip } from './recurring-calendar-event-chip';
import {
  DEFAULT_ACCENT,
  DEFAULT_RECURRING_CALENDAR_LABELS,
  type RecurringCalendarEvent,
  type RecurringCalendarLabels,
  type RecurringCalendarView,
  type RecurringEventStatus,
  type WeekDay,
} from './recurring-calendar-types';

interface RecurringCalendarProps {
  view: RecurringCalendarView;
  onViewChange?: (view: RecurringCalendarView) => void;
  /** Anchor date ('YYYY-MM-DD') that decides the visible month/week/day. */
  date: string;
  /** Highlighted date; defaults to `date`. */
  selectedDate?: string;
  /**
   * Called when a day is clicked or reached with the arrow keys. Move `date`
   * along with it if the new day falls outside the visible range.
   */
  onSelectDate?: (date: string) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onToday?: () => void;
  onEventClick?: (event: RecurringCalendarEvent) => void;
  /** Today's date ('YYYY-MM-DD'), passed in so server and client agree. */
  today?: string;
  events: RecurringCalendarEvent[];
  /** First column of week/month views (0 = Sunday, 1 = Monday). */
  weekStartsOn?: WeekDay;
  /** Translated texts; anything missing falls back to English. */
  labels?: Partial<RecurringCalendarLabels>;
  /** Override the header title (default composes labels, no Intl). */
  formatTitle?: (
    view: RecurringCalendarView,
    range: { start: string; end: string },
  ) => string;
  className?: string;
}

function startOfWeek(value: string, weekStartsOn: WeekDay): string {
  const date = parseDateOnly(value)!;
  const diff = (date.getDay() - weekStartsOn + 7) % 7;
  return addDaysToDateOnly(value, -diff);
}

function monthGrid(value: string, weekStartsOn: WeekDay): string[][] {
  const anchor = parseDateOnly(value)!;
  const first = toDateOnly(
    new Date(anchor.getFullYear(), anchor.getMonth(), 1),
  );
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const lastValue = toDateOnly(last);
  const weeks: string[][] = [];
  let cursor = startOfWeek(first, weekStartsOn);
  while (weeks.length === 0 || cursor <= lastValue) {
    const week: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(cursor);
      cursor = addDaysToDateOnly(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function dayParts(value: string) {
  const date = parseDateOnly(value)!;
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    weekday: date.getDay(),
  };
}

function RecurringCalendar({
  view,
  onViewChange,
  date,
  selectedDate,
  onSelectDate,
  onPrevious,
  onNext,
  onToday,
  onEventClick,
  today,
  events,
  weekStartsOn = 0,
  labels: labelOverrides,
  formatTitle,
  className,
}: RecurringCalendarProps) {
  const labels = { ...DEFAULT_RECURRING_CALENDAR_LABELS, ...labelOverrides };
  const selected = selectedDate ?? date;
  const titleId = React.useId();
  const gridRef = React.useRef<HTMLDivElement>(null);
  const keyboardMove = React.useRef(false);

  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, RecurringCalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.date);
      if (list) list.push(event);
      else map.set(event.date, [event]);
    }
    return map;
  }, [events]);

  // After an arrow-key move, focus the newly selected day.
  React.useEffect(() => {
    if (!keyboardMove.current) return;
    keyboardMove.current = false;
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${selected}"]`)
      ?.focus();
  }, [selected, date]);

  const weekdayOrder = Array.from(
    { length: 7 },
    (_, i) => ((weekStartsOn + i) % 7) as WeekDay,
  );

  const weekStart = startOfWeek(date, weekStartsOn);
  const range =
    view === 'day'
      ? { start: date, end: date }
      : view === 'week'
        ? { start: weekStart, end: addDaysToDateOnly(weekStart, 6) }
        : (() => {
            const grid = monthGrid(date, weekStartsOn);
            const anchor = parseDateOnly(date)!;
            return {
              start: toDateOnly(
                new Date(anchor.getFullYear(), anchor.getMonth(), 1),
              ),
              end: toDateOnly(
                new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0),
              ),
              grid,
            };
          })();

  const longDate = (value: string) => {
    const p = dayParts(value);
    return `${labels.weekdays[p.weekday]} ${p.day} ${labels.months[p.month]} ${p.year}`;
  };

  const defaultTitle = () => {
    const s = dayParts(range.start);
    const e = dayParts(range.end);
    if (view === 'month') return `${labels.months[s.month]} ${s.year}`;
    if (view === 'day') return longDate(range.start);
    if (s.month === e.month) {
      return `${s.day}–${e.day} ${labels.months[s.month]} ${s.year}`;
    }
    return `${s.day} ${labels.months[s.month]} – ${e.day} ${labels.months[e.month]} ${e.year}`;
  };
  const title = formatTitle
    ? formatTitle(view, { start: range.start, end: range.end })
    : defaultTitle();

  const dayLabel = (value: string) => {
    const count = eventsByDate.get(value)?.length ?? 0;
    return count > 0
      ? `${longDate(value)}, ${labels.eventCount(count)}`
      : longDate(value);
  };

  const handleGridKeyDown = (event: React.KeyboardEvent) => {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: view === 'month' ? -7 : -1,
      ArrowDown: view === 'month' ? 7 : 1,
    };
    let next: string | undefined;
    if (event.key in steps) {
      next = addDaysToDateOnly(selected, steps[event.key]!);
    } else if (event.key === 'Home') {
      next = startOfWeek(selected, weekStartsOn);
    } else if (event.key === 'End') {
      next = addDaysToDateOnly(startOfWeek(selected, weekStartsOn), 6);
    }
    if (!next) return;
    event.preventDefault();
    keyboardMove.current = true;
    onSelectDate?.(next);
  };

  return (
    <section
      data-slot="recurring-calendar"
      aria-labelledby={titleId}
      className={cn(
        'flex flex-col gap-4 rounded-card border border-glass-border bg-surface p-4 sm:p-6',
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <IconButton label={labels.previous} onClick={onPrevious}>
            <ChevronLeftIcon aria-hidden className="size-5" />
          </IconButton>
          <IconButton label={labels.next} onClick={onNext}>
            <ChevronRightIcon aria-hidden className="size-5" />
          </IconButton>
          <h2
            id={titleId}
            aria-live="polite"
            className="ml-1 text-base font-bold text-on-background first-letter:uppercase sm:text-title-lg"
          >
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToday}
            className="min-h-9 rounded-button border border-outline px-4 text-sm font-medium text-on-background outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {labels.today}
          </button>
          <div
            role="group"
            aria-label={labels.viewSwitcher}
            className="inline-flex rounded-button bg-muted p-1"
          >
            {(['day', 'week', 'month'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => onViewChange?.(option)}
                className="min-h-8 rounded-button px-3 text-sm font-medium text-on-surface-variant outline-none transition-colors hover:text-on-background focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-surface aria-pressed:text-on-background aria-pressed:shadow-sm"
              >
                {labels.views[option]}
              </button>
            ))}
          </div>
        </div>
      </header>

      {view === 'month' && 'grid' in range ? (
        <div
          ref={gridRef}
          role="grid"
          aria-labelledby={titleId}
          onKeyDown={handleGridKeyDown}
          className="flex flex-col"
        >
          <div role="row" className="grid grid-cols-7">
            {weekdayOrder.map((weekday) => (
              <div
                key={weekday}
                role="columnheader"
                aria-label={labels.weekdays[weekday]}
                className="pb-2 text-center text-label-sm font-medium uppercase text-on-surface-variant"
              >
                <span aria-hidden className="sm:hidden">
                  {labels.weekdaysNarrow[weekday]}
                </span>
                <span aria-hidden className="hidden sm:inline">
                  {labels.weekdaysShort[weekday]}
                </span>
              </div>
            ))}
          </div>
          {range.grid.map((week) => (
            <div
              key={week[0]}
              role="row"
              className="grid grid-cols-7 border-t border-outline"
            >
              {week.map((day) => {
                const parts = dayParts(day);
                const outside = parts.month !== dayParts(date).month;
                const dayEvents = eventsByDate.get(day) ?? [];
                const visible = dayEvents.slice(0, 3);
                const hidden = dayEvents.length - visible.length;
                const isSelected = day === selected;
                const isToday = day === today;
                return (
                  <div key={day} role="gridcell" aria-selected={isSelected}>
                    <button
                      type="button"
                      data-date={day}
                      tabIndex={isSelected ? 0 : -1}
                      aria-label={dayLabel(day)}
                      aria-current={isToday ? 'date' : undefined}
                      onClick={() => onSelectDate?.(day)}
                      className={cn(
                        'flex min-h-14 w-full flex-col items-center gap-1 rounded-chip p-1 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-h-28 sm:items-stretch sm:p-1.5',
                        isSelected && 'bg-accent',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'flex size-7 items-center justify-center rounded-full text-sm',
                          outside
                            ? 'text-on-surface-variant'
                            : 'text-on-background',
                          isToday && 'font-bold ring-1 ring-ring',
                          isSelected &&
                            'bg-accent-neon font-bold text-secondary-foreground ring-0',
                        )}
                      >
                        {parts.day}
                      </span>
                      {/* Narrow screens: dots. */}
                      {dayEvents.length > 0 ? (
                        <span
                          aria-hidden
                          className="flex items-center gap-0.5 sm:hidden"
                        >
                          {visible.map((event) => (
                            <span
                              key={event.id}
                              className="size-1.5 rounded-full"
                              style={{
                                backgroundColor: event.color ?? DEFAULT_ACCENT,
                              }}
                            />
                          ))}
                          {hidden > 0 ? (
                            <span className="text-[10px] leading-none text-on-surface-variant">
                              +
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                      {/* Wider screens: chips. */}
                      <span
                        aria-hidden
                        className="hidden flex-col gap-0.5 sm:flex"
                      >
                        {visible.map((event) => (
                          <RecurringCalendarEventChip
                            key={event.id}
                            event={event}
                            compact
                          />
                        ))}
                        {hidden > 0 ? (
                          <span className="px-1 text-[11px] font-medium text-on-surface-variant">
                            {labels.more(hidden)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}

      {view === 'week' ? (
        <div
          ref={gridRef}
          onKeyDown={handleGridKeyDown}
          className="grid grid-cols-1 gap-2 sm:grid-cols-7"
        >
          {weekdayOrder.map((_, index) => {
            const day = addDaysToDateOnly(weekStart, index);
            const parts = dayParts(day);
            const dayEvents = eventsByDate.get(day) ?? [];
            const isSelected = day === selected;
            const isToday = day === today;
            return (
              <div
                key={day}
                className={cn(
                  'flex min-w-0 flex-col gap-2 rounded-chip border border-outline p-2 sm:min-h-40',
                  isSelected && 'border-ring',
                )}
              >
                <button
                  type="button"
                  data-date={day}
                  aria-label={dayLabel(day)}
                  aria-current={isToday ? 'date' : undefined}
                  aria-pressed={isSelected}
                  onClick={() => onSelectDate?.(day)}
                  className="flex min-h-11 items-center gap-2 rounded-lg px-1 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:flex-col sm:items-start sm:gap-0"
                >
                  <span className="text-label-sm font-medium uppercase text-on-surface-variant">
                    {labels.weekdaysShort[parts.weekday]}
                  </span>
                  <span
                    className={cn(
                      'flex size-8 items-center justify-center rounded-full text-base font-bold text-on-background',
                      isToday && 'ring-1 ring-ring',
                      isSelected &&
                        'bg-accent-neon text-secondary-foreground ring-0',
                    )}
                  >
                    {parts.day}
                  </span>
                </button>
                {dayEvents.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {dayEvents.map((event) => (
                      <li key={event.id}>
                        <RecurringCalendarEventChip
                          event={event}
                          statusLabel={labels.status[event.status]}
                          onClick={onEventClick}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {view === 'day' ? (
        <RecurringCalendarDayList
          events={eventsByDate.get(date) ?? []}
          labels={labels}
          onEventClick={onEventClick}
        />
      ) : null}
    </section>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full text-on-background outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {children}
    </button>
  );
}

export {
  RecurringCalendar,
  type RecurringCalendarEvent,
  type RecurringCalendarLabels,
  type RecurringCalendarProps,
  type RecurringCalendarView,
  type RecurringEventStatus,
};
