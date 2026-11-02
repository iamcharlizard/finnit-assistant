'use client';

import * as React from 'react';

import {
  DEFAULT_MONEY_COUNTRY,
  caretForTokens,
  completeMoneyValue,
  countMoneyTokens,
  formatMoneyText,
  moneyFormat,
  normalizeMoneyValue,
  sanitizeMoneyText,
  type MoneyCountry,
  type MoneyFormat,
} from '../../lib/money-format';
import { cn } from '../../lib/utils';
import { Label } from './label';

const MoneyFormatContext = React.createContext<MoneyFormat>(
  moneyFormat(DEFAULT_MONEY_COUNTRY),
);

/**
 * The money format of everything inside (Mexico when there's none): set it
 * once per app or per user's country.
 */
function MoneyFormatProvider({
  country = DEFAULT_MONEY_COUNTRY,
  format,
  children,
}: {
  country?: MoneyCountry;
  /** A custom format instead of a country's. */
  format?: MoneyFormat;
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => format ?? moneyFormat(country),
    [country, format],
  );
  return (
    <MoneyFormatContext.Provider value={value}>
      {children}
    </MoneyFormatContext.Provider>
  );
}

/** The format in use, with the currency overridden when given. */
function useMoneyFormat(currency?: string): MoneyFormat {
  const format = React.useContext(MoneyFormatContext);
  return React.useMemo(() => moneyFormat(format, currency), [format, currency]);
}

interface MoneyMaskOptions {
  /** Raw value: digits and "." for cents ("1250000.5"); "" when empty. */
  value: string;
  onValueChange: (value: string) => void;
  format: MoneyFormat;
  /** Fill the cents when leaving the field ("1200" → "1200.00"). */
  completeOnBlur?: boolean;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}

/**
 * The masking behind MoneyInput, for fields with their own look: only
 * digits and one decimal separator get in, separators are added as you
 * type, and the caret stays after the same digit.
 */
function useMoneyMask({
  value,
  onValueChange,
  format,
  completeOnBlur = true,
  onBlur,
}: MoneyMaskOptions) {
  const ref = React.useRef<HTMLInputElement>(null);
  const caret = React.useRef<number | null>(null);
  const raw = normalizeMoneyValue(value, format.decimals);
  const display = formatMoneyText(raw, format);

  React.useLayoutEffect(() => {
    const input = ref.current;
    if (caret.current === null || !input || document.activeElement !== input)
      return;
    const position = caretForTokens(display, caret.current, format);
    caret.current = null;
    input.setSelectionRange(position, position);
  }, [display, format]);

  return {
    ref,
    value: display,
    inputMode: (format.decimals > 0 ? 'decimal' : 'numeric') as
      | 'decimal'
      | 'numeric',
    autoComplete: 'off',
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const before = input.value.slice(
        0,
        input.selectionStart ?? input.value.length,
      );
      let tokens = countMoneyTokens(before, format);
      let next = sanitizeMoneyText(input.value, format);
      // Deleting only a separator ("1,|234" + Backspace) deletes the digit
      // next to it, as nothing else would change.
      if (next === raw && input.value.length < display.length && tokens > 0) {
        const deleted = (event.nativeEvent as InputEvent).inputType;
        const at = deleted === 'deleteContentForward' ? tokens : tokens - 1;
        next = sanitizeMoneyText(raw.slice(0, at) + raw.slice(at + 1), {
          ...format,
          decimalSeparator: '.',
        });
        tokens = at;
      }
      caret.current = tokens;
      onValueChange(next);
    },
    onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
      if (completeOnBlur && raw) {
        const complete = completeMoneyValue(raw, format.decimals);
        if (complete !== raw) onValueChange(complete);
      }
      onBlur?.(event);
    },
  };
}

interface MoneyInputProps extends Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'inputMode' | 'defaultValue'
> {
  label?: string;
  error?: string;
  /** Raw value: digits and "." for cents ("1250000.5"); "" when empty. */
  value: string;
  onValueChange: (value: string) => void;
  /** Currency of the amount when it isn't the format's (e.g. an account in USD). */
  currency?: string;
  /** A country or format instead of the one from MoneyFormatProvider. */
  format?: MoneyCountry | MoneyFormat;
  /** Show the currency code at the end (default true). */
  showCurrency?: boolean;
  /** Fill the cents when leaving the field (default true). */
  completeOnBlur?: boolean;
}

/**
 * An amount of money: only numbers, shown in the country's format while you
 * type ("$ 1'250,000.50 MXN" in Mexico). The value stays raw ("1250000.50"),
 * so forms parse it the same way in every country.
 */
function MoneyInput({
  label,
  error,
  value,
  onValueChange,
  currency,
  format: formatProp,
  showCurrency = true,
  completeOnBlur,
  onBlur,
  id,
  className,
  placeholder,
  ...props
}: MoneyInputProps) {
  const contextFormat = useMoneyFormat(currency);
  const format = formatProp ? moneyFormat(formatProp, currency) : contextFormat;
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const mask = useMoneyMask({
    value,
    onValueChange,
    format,
    completeOnBlur,
    onBlur,
  });
  const prefix = format.symbolPosition === 'prefix';

  const field = (
    <div
      data-slot="money-input"
      className={cn(
        'flex min-h-11 w-full min-w-0 items-center gap-2 rounded-input border border-input bg-surface px-4 transition-[color,box-shadow]',
        'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40',
        'has-[input[aria-invalid=true]]:border-expense has-[input[aria-invalid=true]]:ring-expense/20',
        'has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50',
        className,
      )}
    >
      {prefix ? (
        <span aria-hidden className="text-body-md text-on-surface-variant">
          {format.symbol}
        </span>
      ) : null}
      <input
        id={inputId}
        type="text"
        data-slot="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        placeholder={
          placeholder ??
          formatMoneyText(completeMoneyValue('0', format.decimals), format)
        }
        className="min-w-0 flex-1 bg-transparent py-3 text-body-md text-on-background tabular-nums outline-none placeholder:text-on-surface-variant/70 disabled:cursor-not-allowed"
        {...props}
        {...mask}
      />
      {!prefix ? (
        <span aria-hidden className="text-body-md text-on-surface-variant">
          {format.symbol}
        </span>
      ) : null}
      {showCurrency ? (
        <span
          aria-hidden
          className="text-xs font-medium text-on-surface-variant"
        >
          {format.currency}
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

export {
  MoneyFormatProvider,
  MoneyInput,
  useMoneyFormat,
  useMoneyMask,
  type MoneyInputProps,
};
