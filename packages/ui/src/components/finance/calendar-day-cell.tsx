'use client';

import { cn } from '../../lib/utils';

type CalendarEventAccent = 'primary' | 'neon';

interface CalendarEvent {
  label: string;
  accent: CalendarEventAccent;
}

interface CalendarDayCellProps {
  day: number;
  outsideMonth?: boolean;
  isToday?: boolean;
  isSelected?: boolean;
  event?: CalendarEvent;
  onSelect?: (day: number) => void;
}

function CalendarDayCell({
  day,
  outsideMonth = false,
  isToday = false,
  isSelected = false,
  event,
  onSelect,
}: CalendarDayCellProps) {
  const label = String(day).padStart(2, '0');

  if (outsideMonth) {
    return (
      <div
        aria-hidden
        className="aspect-square rounded-lg p-1 text-[10px] text-on-surface-variant"
      >
        {label}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect?.(day)}
      aria-pressed={isSelected}
      aria-current={isToday ? 'date' : undefined}
      className={cn(
        'relative flex aspect-square flex-col items-start rounded-lg border p-1 text-left text-[11px] leading-[13px] outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:p-1.5 sm:text-sm',
        isToday
          ? 'border-2 border-brand bg-[#00f5ff]/6 font-bold text-brand-ink'
          : event?.accent === 'primary'
            ? 'border-brand/40 bg-[#00f5ff]/5 font-bold text-brand-ink'
            : event?.accent === 'neon'
              ? 'border-[#6c72cb]/40 bg-[#6c72cb]/5 font-bold text-violet-ink'
              : 'border-on-background/7 text-on-background',
        isSelected && !isToday && !event && 'bg-on-background/5',
      )}
    >
      {isToday ? (
        <span className="mb-px self-center rounded-full bg-brand px-1.5 text-[7px] font-bold tracking-wide text-brand-foreground sm:text-[9px]">
          HOY
        </span>
      ) : null}
      {label}
      {event ? (
        <>
          <span className="sr-only mt-auto w-full truncate text-[10px] font-medium sm:not-sr-only">
            {event.label}
          </span>
          <span
            aria-hidden
            className={cn(
              'absolute inset-x-1 bottom-1 h-0.5 rounded-full',
              event.accent === 'primary' ? 'bg-[#00f5ff]' : 'bg-[#6c72cb]',
            )}
          />
        </>
      ) : null}
    </button>
  );
}

export {
  CalendarDayCell,
  type CalendarDayCellProps,
  type CalendarEvent,
  type CalendarEventAccent,
};
