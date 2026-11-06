import * as React from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react-native';

import {
  addDays,
  daysInMonth,
  firstDayOf,
  monthLabel,
  monthOf,
  shiftMonth,
  shortDate,
  todayKey,
  weekdayIndex,
  weekdayNames,
  type DayKey,
  type MonthRef,
} from '@finnit/core/finance/dates';
import type { Locale } from '@finnit/core/i18n/locales';

import { cn } from '../../lib/utils';
import { TwPressable, TwView } from '../../lib/tw';
import { Field, fieldBoxClass } from './field';
import { Icon } from './icon';
import { Sheet } from './sheet';
import { Text } from './text';

interface DatePickerProps {
  value?: DayKey;
  onChange: (value: DayKey | undefined) => void;
  locale: Locale;
  label?: string;
  error?: string;
  placeholder?: string;
  min?: DayKey;
  max?: DayKey;
  /** An × that empties the field. */
  clearable?: boolean;
  clearLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  closeLabel?: string;
  disabled?: boolean;
  className?: string;
}

/** Day cells for a month grid, Monday first; null pads the first week. */
function monthGrid(month: MonthRef): (DayKey | null)[] {
  const first = firstDayOf(month);
  const lead = (weekdayIndex(first) + 6) % 7;
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => addDays(first, i));
  return [...Array<null>(lead).fill(null), ...days];
}

/** A date field that opens a month calendar (the web's DatePicker). */
function DatePicker({
  value,
  onChange,
  locale,
  label,
  error,
  placeholder = '',
  min,
  max,
  clearable,
  clearLabel = 'Clear',
  previousLabel = 'Previous month',
  nextLabel = 'Next month',
  closeLabel,
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const today = todayKey();
  const [month, setMonth] = React.useState<MonthRef>(() => monthOf(value ?? max ?? today));
  const names = weekdayNames(locale);
  // weekdayNames is Sunday first; the grid is Monday first.
  const headers = [...names.slice(1), names[0]!].map((n) => n.slice(0, 2));

  const openPicker = () => {
    setMonth(monthOf(value ?? max ?? today));
    setOpen(true);
  };

  return (
    <Field label={label} error={error}>
      <TwView className={cn(fieldBoxClass({ focused: open, error, disabled }), 'min-h-12 flex-row items-center', className)}>
        <TwPressable
          accessibilityRole="button"
          accessibilityLabel={label ? `${label}: ${value ? shortDate(value, locale) : placeholder}` : undefined}
          disabled={disabled}
          onPress={openPicker}
          className="min-h-12 flex-1 flex-row items-center gap-2 pl-4 pr-2"
        >
          <Icon icon={CalendarDays} size={18} color="--on-surface-variant" />
          <Text numberOfLines={1} className={cn('flex-1 text-base', value ? 'text-on-background' : 'text-on-surface-variant')}>
            {value ? shortDate(value, locale) : placeholder}
          </Text>
        </TwPressable>
        {clearable && value ? (
          <TwPressable
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            onPress={() => onChange(undefined)}
            className="min-h-12 min-w-11 items-center justify-center"
          >
            <Icon icon={X} size={16} color="--on-surface-variant" />
          </TwPressable>
        ) : null}
      </TwView>

      <Sheet open={open} onOpenChange={setOpen} title={label ?? placeholder} closeLabel={closeLabel}>
        <TwView className="mb-2 flex-row items-center justify-between">
          <TwPressable
            accessibilityRole="button"
            accessibilityLabel={previousLabel}
            onPress={() => setMonth((m) => shiftMonth(m, -1))}
            className="size-11 items-center justify-center rounded-full active:bg-accent"
          >
            <Icon icon={ChevronLeft} size={20} />
          </TwPressable>
          <Text weight="bold" className="text-base capitalize">
            {monthLabel(month, locale)}
          </Text>
          <TwPressable
            accessibilityRole="button"
            accessibilityLabel={nextLabel}
            onPress={() => setMonth((m) => shiftMonth(m, 1))}
            className="size-11 items-center justify-center rounded-full active:bg-accent"
          >
            <Icon icon={ChevronRight} size={20} />
          </TwPressable>
        </TwView>
        <TwView className="flex-row">
          {headers.map((h, i) => (
            <Text key={i} className="flex-1 py-1 text-center text-xs uppercase text-on-surface-variant">
              {h}
            </Text>
          ))}
        </TwView>
        <TwView className="flex-row flex-wrap pb-2">
          {monthGrid(month).map((day, index) => {
            if (!day) return <TwView key={`pad-${index}`} style={{ width: `${100 / 7}%` }} />;
            const outside = Boolean((min && day < min) || (max && day > max));
            const selected = day === value;
            return (
              <TwView key={day} style={{ width: `${100 / 7}%` }} className="items-center py-0.5">
                <TwPressable
                  accessibilityRole="button"
                  accessibilityLabel={shortDate(day, locale)}
                  accessibilityState={{ selected, disabled: outside }}
                  disabled={outside}
                  onPress={() => {
                    onChange(day);
                    setOpen(false);
                  }}
                  className={cn(
                    'size-11 items-center justify-center rounded-full',
                    selected ? 'bg-primary' : day === today ? 'border border-brand-ink' : 'active:bg-accent',
                    outside && 'opacity-30',
                  )}
                >
                  <Text
                    weight={selected ? 'bold' : 'regular'}
                    className={cn('text-sm', selected ? 'text-primary-foreground' : 'text-on-background')}
                  >
                    {String(Number(day.slice(8)))}
                  </Text>
                </TwPressable>
              </TwView>
            );
          })}
        </TwView>
      </Sheet>
    </Field>
  );
}

export { DatePicker, type DatePickerProps };
