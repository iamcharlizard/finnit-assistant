import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { addDays, daysInMonth, firstDayOf, parseDayKey, weekdayIndex, type DayKey } from '@finnit/core/finance/dates';
import type { RecurringCalendarEvent, RecurringCalendarLabels } from '@finnit/core/ui/recurring-calendar';

import { cn } from '../../lib/utils';
import { TwPressable, TwView } from '../../lib/tw';
import { useColor, useToken } from '../../theme/theme-root';
import { Icon } from '../ui/icon';
import { Text } from '../ui/text';

const STATUS_DOT: Record<RecurringCalendarEvent['status'], `--${string}`> = {
  upcoming: '--accent-neon',
  paid: '--income',
  skipped: '--on-surface-variant-50',
  missed: '--expense',
  reminder: '--highlight',
};

/**
 * The recurring payments' month (@finnit/ui's RecurringCalendar, month
 * view): a grid of days with a dot per payment; a tap picks a day.
 */
function RecurringCalendar({
  month,
  events,
  today,
  selectedDay,
  onSelectDay,
  onPrevious,
  onNext,
  onToday,
  title,
  labels,
}: {
  /** Any day of the month shown. */
  month: DayKey;
  events: RecurringCalendarEvent[];
  today: DayKey;
  selectedDay: DayKey | null;
  onSelectDay: (day: DayKey | null) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  title: string;
  labels: Pick<RecurringCalendarLabels, 'weekdaysNarrow' | 'previous' | 'next' | 'today' | 'eventCount'>;
}) {
  const color = useColor();
  const tokens = { muted: useToken('--on-surface-variant') };
  const { year, month: m } = parseDayKey(month);
  const first = firstDayOf({ year, month: m });
  const lead = (weekdayIndex(first) + 6) % 7;
  const days = Array.from({ length: daysInMonth({ year, month: m }) }, (_, i) => addDays(first, i));
  const cells: (DayKey | null)[] = [...Array<null>(lead).fill(null), ...days];
  const byDay = React.useMemo(() => {
    const map = new Map<DayKey, RecurringCalendarEvent[]>();
    for (const event of events) map.set(event.date, [...(map.get(event.date) ?? []), event]);
    return map;
  }, [events]);
  // Monday first (the labels are Sunday first).
  const headers = [...labels.weekdaysNarrow.slice(1), labels.weekdaysNarrow[0]!];

  return (
    <TwView className="gap-2 rounded-card border border-glass-border bg-glass p-3">
      <TwView className="flex-row items-center justify-between">
        <TwPressable accessibilityRole="button" accessibilityLabel={labels.previous} onPress={onPrevious} className="size-11 items-center justify-center rounded-full active:bg-accent">
          <Icon icon={ChevronLeft} size={20} />
        </TwPressable>
        <TwPressable accessibilityRole="button" accessibilityLabel={labels.today} onPress={onToday} className="min-h-11 justify-center px-2">
          <Text weight="bold" className="text-base capitalize">
            {title}
          </Text>
        </TwPressable>
        <TwPressable accessibilityRole="button" accessibilityLabel={labels.next} onPress={onNext} className="size-11 items-center justify-center rounded-full active:bg-accent">
          <Icon icon={ChevronRight} size={20} />
        </TwPressable>
      </TwView>
      <TwView className="flex-row">
        {headers.map((h, i) => (
          <Text key={i} className="flex-1 text-center text-xs text-on-surface-variant" style={{ color: tokens.muted }}>
            {h}
          </Text>
        ))}
      </TwView>
      <TwView className="flex-row flex-wrap">
        {cells.map((day, index) => {
          if (!day) return <TwView key={`pad-${index}`} style={{ width: `${100 / 7}%`, height: 52 }} />;
          const dayEvents = byDay.get(day) ?? [];
          const selected = day === selectedDay;
          return (
            <TwView key={day} style={{ width: `${100 / 7}%`, height: 52 }} className="p-0.5">
              <TwPressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${Number(day.slice(8))}, ${labels.eventCount(dayEvents.length)}`}
                onPress={() => onSelectDay(selected ? null : day)}
                className={cn(
                  'flex-1 items-center justify-center gap-1 rounded-xl',
                  selected ? 'bg-primary-15' : 'active:bg-accent',
                  day === today && !selected && 'border border-brand-ink',
                )}
              >
                <Text weight={day === today ? 'bold' : 'regular'} className="text-sm">
                  {String(Number(day.slice(8)))}
                </Text>
                <TwView className="h-1.5 flex-row gap-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <TwView
                      key={event.id}
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: event.color ? color(event.color) : undefined }}
                    >
                      {event.color ? null : <DotFallback token={STATUS_DOT[event.status]} />}
                    </TwView>
                  ))}
                </TwView>
              </TwPressable>
            </TwView>
          );
        })}
      </TwView>
    </TwView>
  );
}

function DotFallback({ token }: { token: `--${string}` }) {
  return <TwView className="size-1.5 rounded-full" style={{ backgroundColor: useToken(token) }} />;
}

export { RecurringCalendar };
