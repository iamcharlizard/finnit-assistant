'use client';

import * as React from 'react';

import { sanitizeNumberText, type NumberRules } from '../../lib/number-format';
import { cn } from '../../lib/utils';
import { Label } from './label';

interface NumberInputProps
  extends
    Omit<
      React.ComponentProps<'input'>,
      'value' | 'onChange' | 'type' | 'inputMode' | 'defaultValue'
    >,
    NumberRules {
  label?: string;
  error?: string;
  /** Plain number as text ("12", "45.5", "-3"); "" when empty. */
  value: string;
  onValueChange: (value: string) => void;
  /** Shown after the number, e.g. "%". */
  suffix?: string;
}

/**
 * A number that isn't money (a rate, a count, a day of the month): letters
 * and symbols never get in. Whole numbers unless `decimals`; the value is
 * the plain number as text, with "." for decimals. For amounts use
 * MoneyInput.
 */
function NumberInput({
  label,
  error,
  value,
  onValueChange,
  decimals = 0,
  allowNegative = false,
  maxDigits,
  suffix,
  id,
  className,
  ...props
}: NumberInputProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  const field = (
    <div
      data-slot="number-input"
      className={cn(
        'flex min-h-11 w-full min-w-0 items-center gap-2 rounded-input border border-input bg-surface px-4 transition-[color,box-shadow]',
        'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40',
        'has-[input[aria-invalid=true]]:border-expense has-[input[aria-invalid=true]]:ring-expense/20',
        'has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50',
        className,
      )}
    >
      <input
        id={inputId}
        type="text"
        data-slot="input"
        inputMode={decimals > 0 ? 'decimal' : 'numeric'}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="min-w-0 flex-1 bg-transparent py-3 text-body-md text-on-background tabular-nums outline-none placeholder:text-on-surface-variant/70 disabled:cursor-not-allowed"
        {...props}
        value={value}
        onChange={(event) =>
          onValueChange(
            sanitizeNumberText(event.target.value, {
              decimals,
              allowNegative,
              maxDigits,
            }),
          )
        }
      />
      {suffix ? (
        <span aria-hidden className="text-body-md text-on-surface-variant">
          {suffix}
        </span>
      ) : null}
    </div>
  );

  if (!label && !error) return field;

  return (
    <div className="flex flex-col gap-1">
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      {field}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-expense">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { NumberInput, type NumberInputProps };
