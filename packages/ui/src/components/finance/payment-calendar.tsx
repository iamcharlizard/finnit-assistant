'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '../../lib/utils';
import { CalendarDayCell, type CalendarEvent } from './calendar-day-cell';

type CalendarViewMode = 'month' | 'week';

interface PaymentCalendarProps {
  monthLabel: string;
  /** Trailing days of the previous month shown before day 1. */
  leadingDays: number[];
  daysInMonth: number;
  today?: number;
  events?: Partial<Record<number, CalendarEvent>>;
  selectedDay?: number | null;
  onSelectDay?: (day: number) => void;
  viewMode?: CalendarViewMode;
  onViewModeChange?: (mode: CalendarViewMode) => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  className?: string;
}

const DAY_HEADERS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const VIEW_MODES: ReadonlyArray<{
  value: CalendarViewMode;
  label: string;
  aria: string;
}> = [
  { value: 'month', label: 'MES', aria: 'Vista mensual' },
  { value: 'week', label: 'SEMANA', aria: 'Vista semanal' },
];

function PaymentCalendar({
  monthLabel,
  leadingDays,
  daysInMonth,
  today,
  events = {},
  selectedDay = null,
  onSelectDay,
  viewMode = 'month',
  onViewModeChange,
  onPrevMonth,
  onNextMonth,
  className,
}: PaymentCalendarProps) {
  return (
    <section
      aria-label={`Calendario de pagos, ${monthLabel}`}
      className={cn(
        'rounded-[20px] border border-glass-border bg-glass p-4 shadow-[0_8px_32px_rgba(0,0,0,0.05)] backdrop-blur-md dark:shadow-[0_8px_32px_rgba(0,0,0,0.25)]',
        className,
      )}
    >
      <div className="mb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onPrevMonth}
            aria-label="Mes anterior"
            className="flex size-11 items-center justify-center rounded-full text-on-surface-variant outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <h3 className="text-[17px] font-bold text-on-background">
            {monthLabel}
          </h3>
          <button
            type="button"
            onClick={onNextMonth}
            aria-label="Mes siguiente"
            className="flex size-11 items-center justify-center rounded-full text-on-surface-variant outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>

        <div className="flex gap-1">
          {VIEW_MODES.map((mode) => {
            const isActive = viewMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => onViewModeChange?.(mode.value)}
                aria-pressed={isActive}
                aria-label={mode.aria}
                className={cn(
                  'min-h-8 rounded-full px-2.5 py-1 text-[11px] tracking-wide outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  isActive
                    ? 'bg-brand/12 font-bold text-brand-ink'
                    : 'font-medium text-on-surface-variant hover:bg-accent',
                )}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-[3px]">
        {DAY_HEADERS.map((header, i) => (
          <span
            key={header}
            className={cn(
              'py-1 text-center text-[9px] font-medium tracking-wide',
              i >= 5 ? 'text-brand-ink' : 'text-on-surface-variant',
            )}
          >
            {header}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-[3px]">
        {leadingDays.map((day) => (
          <CalendarDayCell key={`prev-${day}`} day={day} outsideMonth />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
          <CalendarDayCell
            key={day}
            day={day}
            isToday={day === today}
            isSelected={day === selectedDay}
            event={events[day]}
            onSelect={onSelectDay}
          />
        ))}
      </div>
    </section>
  );
}

export { PaymentCalendar, type PaymentCalendarProps, type CalendarViewMode };
