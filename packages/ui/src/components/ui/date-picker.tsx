'use client';

import * as React from 'react';
import { DateLib } from 'react-day-picker';
import { CalendarIcon } from 'lucide-react';

import { parseDateOnly, toDateOnly } from '../../lib/date-only';
import { cn } from '../../lib/utils';
import { Calendar, CALENDAR_LOCALES, type CalendarLocale } from './calendar';
import { Label } from './label';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

interface DatePickerProps {
  /** Selected date as 'YYYY-MM-DD' (date-only, no time zone). */
  value?: string;
  onChange?: (value: string | undefined) => void;
  /** Earliest selectable date, 'YYYY-MM-DD' (inclusive). */
  min?: string;
  /** Latest selectable date, 'YYYY-MM-DD' (inclusive). */
  max?: string;
  placeholder?: string;
  locale?: CalendarLocale;
  /**
   * date-fns format for the button text (rendered with the locale, no `Intl`,
   * so server and browser output match). Defaults to 'PPP' (e.g. "October 13th, 2026").
   */
  displayFormat?: string;
  disabled?: boolean;
  label?: string;
  error?: string;
  id?: string;
  name?: string;
  required?: boolean;
  'aria-label'?: string;
  className?: string;
}

function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = 'Pick a date',
  locale = 'en',
  displayFormat = 'PPP',
  disabled,
  label,
  error,
  id,
  name,
  required,
  'aria-label': ariaLabel,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const generatedId = React.useId();
  const triggerId = id ?? generatedId;
  const errorId = `${triggerId}-error`;

  const selected = parseDateOnly(value);
  const minDate = parseDateOnly(min);
  const maxDate = parseDateOnly(max);
  const dayPickerLocale = CALENDAR_LOCALES[locale];

  const display = selected
    ? new DateLib({ locale: dayPickerLocale }).format(selected, displayFormat)
    : undefined;

  const disabledMatchers = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  const trigger = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={triggerId}
          type="button"
          data-slot="date-picker-trigger"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          aria-required={required || undefined}
          className={cn(
            'flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-input border border-input bg-surface px-4 py-3 text-left text-body-md text-on-background outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40',
            'aria-invalid:border-expense aria-invalid:ring-expense/20',
            !display && 'text-on-surface-variant',
            className,
          )}
        >
          <span className="truncate">{display ?? placeholder}</span>
          <CalendarIcon
            aria-hidden
            className="size-4 shrink-0 text-on-surface-variant"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={locale}
          selected={selected}
          defaultMonth={selected ?? minDate}
          startMonth={minDate}
          endMonth={maxDate}
          disabled={disabledMatchers}
          autoFocus
          required
          onSelect={(date) => {
            onChange?.(toDateOnly(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
      {name ? <input type="hidden" name={name} value={value ?? ''} /> : null}
    </Popover>
  );

  if (!label && !error) return trigger;

  return (
    <div className="flex flex-col gap-1">
      {label ? <Label htmlFor={triggerId}>{label}</Label> : null}
      {trigger}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-expense">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { DatePicker, type DatePickerProps };
