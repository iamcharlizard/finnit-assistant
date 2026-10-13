'use client';

import * as React from 'react';
import {
  DayPicker,
  getDefaultClassNames,
  type ChevronProps,
  type DayButtonProps,
  type DayPickerProps,
  type DayPickerLocale,
} from 'react-day-picker';
import { enUS, es } from 'react-day-picker/locale';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';

import { cn } from '../../lib/utils';

type CalendarLocale = 'es' | 'en';

/** DayPicker locales (date-fns + translated ARIA labels) bundled with react-day-picker. */
const CALENDAR_LOCALES: Record<CalendarLocale, DayPickerLocale> = {
  es,
  en: enUS,
};

// Omit per union member so the `mode` discriminated union survives.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

type CalendarProps = DistributiveOmit<DayPickerProps, 'locale'> & {
  /** 'es' | 'en' or any DayPicker locale object. Defaults to 'en'. */
  locale?: CalendarLocale | Partial<DayPickerLocale>;
};

const navButton =
  'inline-flex size-(--cell-size) items-center justify-center rounded-full text-on-background outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40';

function Calendar(props: CalendarProps) {
  const {
    className,
    classNames,
    showOutsideDays = true,
    components,
    locale = 'en',
  } = props;
  const d = getDefaultClassNames();
  const resolvedLocale =
    typeof locale === 'string' ? CALENDAR_LOCALES[locale] : locale;

  return (
    <DayPicker
      {...props}
      data-slot="calendar"
      showOutsideDays={showOutsideDays}
      locale={resolvedLocale}
      className={cn('w-fit p-3 [--cell-size:2.75rem]', className)}
      classNames={{
        root: cn('w-fit', d.root),
        months: cn('relative flex flex-col gap-4 md:flex-row', d.months),
        month: cn('flex w-full flex-col gap-3', d.month),
        nav: cn(
          'absolute inset-x-0 top-0 flex w-full items-center justify-between',
          d.nav,
        ),
        button_previous: cn(navButton, d.button_previous),
        button_next: cn(navButton, d.button_next),
        month_caption: cn(
          'flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)',
          d.month_caption,
        ),
        caption_label: cn(
          'select-none text-sm font-bold capitalize text-on-background',
          d.caption_label,
        ),
        dropdowns: cn(
          'flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium',
          d.dropdowns,
        ),
        dropdown_root: cn(
          'relative rounded-lg border border-input has-focus:ring-[3px] has-focus:ring-ring/50',
          d.dropdown_root,
        ),
        dropdown: cn('absolute inset-0 bg-popover opacity-0', d.dropdown),
        month_grid: cn('w-full border-collapse', d.month_grid),
        weekdays: cn('flex', d.weekdays),
        weekday: cn(
          'w-(--cell-size) select-none text-label-sm font-medium uppercase text-on-surface-variant',
          d.weekday,
        ),
        week: cn('mt-1 flex w-full', d.week),
        day: cn(
          'relative size-(--cell-size) p-0 text-center select-none',
          d.day,
        ),
        today: cn('font-bold', d.today),
        outside: cn('text-on-surface-variant', d.outside),
        disabled: cn('opacity-40', d.disabled),
        hidden: cn('invisible', d.hidden),
        ...classNames,
      }}
      components={{
        Chevron: CalendarChevron,
        DayButton: CalendarDayButton,
        ...components,
      }}
    />
  );
}

function CalendarChevron({ className, style, orientation }: ChevronProps) {
  const Icon =
    orientation === 'left'
      ? ChevronLeftIcon
      : orientation === 'right'
        ? ChevronRightIcon
        : ChevronDownIcon;
  return <Icon aria-hidden className={cn('size-5', className)} style={style} />;
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: DayButtonProps) {
  const ref = React.useRef<HTMLButtonElement>(null);

  // A custom DayButton must move focus itself for keyboard navigation.
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.isoDate}
      data-selected={modifiers.selected || undefined}
      data-today={modifiers.today || undefined}
      className={cn(
        'inline-flex size-(--cell-size) items-center justify-center rounded-full text-sm text-inherit outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none',
        'data-[today]:ring-1 data-[today]:ring-ring',
        'data-[selected]:bg-accent-neon data-[selected]:font-bold data-[selected]:text-secondary-foreground data-[selected]:hover:bg-accent-neon/90',
        className,
      )}
      {...props}
    />
  );
}

export {
  Calendar,
  CalendarDayButton,
  CALENDAR_LOCALES,
  type CalendarLocale,
  type CalendarProps,
};
