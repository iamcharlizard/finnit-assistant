import * as React from 'react';
import type { TextInputProps } from 'react-native';

import {
  DEFAULT_MONEY_COUNTRY,
  completeMoneyValue,
  formatMoneyText,
  moneyFormat,
  normalizeMoneyValue,
  sanitizeMoneyText,
  type MoneyCountry,
  type MoneyFormat,
} from '@finnit/core/format/money-format';

import { cn } from '../../lib/utils';
import { TwTextInput, TwView } from '../../lib/tw';
import { useToken } from '../../theme/theme-root';
import { Field, fieldBoxClass } from './field';
import { Text } from './text';

const MoneyFormatContext = React.createContext<MoneyFormat>(
  moneyFormat(DEFAULT_MONEY_COUNTRY),
);

/** The money format of everything inside (Mexico when there's none). */
function MoneyFormatProvider({
  country = DEFAULT_MONEY_COUNTRY,
  format,
  children,
}: {
  country?: MoneyCountry;
  format?: MoneyFormat;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => format ?? moneyFormat(country), [country, format]);
  return <MoneyFormatContext.Provider value={value}>{children}</MoneyFormatContext.Provider>;
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
}

/**
 * The masking behind MoneyInput (same rules as the web's useMoneyMask):
 * only digits and one decimal separator get in and separators are added as
 * you type. On a phone the caret stays at the end, where people type.
 */
function useMoneyMask({ value, onValueChange, format, completeOnBlur = true }: MoneyMaskOptions) {
  const raw = normalizeMoneyValue(value, format.decimals);
  const display = formatMoneyText(raw, format);
  return {
    value: display,
    keyboardType: (format.decimals > 0 ? 'decimal-pad' : 'number-pad') as TextInputProps['keyboardType'],
    autoComplete: 'off' as const,
    onChangeText: (text: string) => {
      let next = sanitizeMoneyText(text, format);
      // Backspace over a separator ("1,234" → "1,23" is fine; "1," → "1")
      // removes the digit before it, as nothing else would change.
      if (next === raw && text.length < display.length && raw.length > 0) {
        next = sanitizeMoneyText(raw.slice(0, -1), { ...format, decimalSeparator: '.' });
      }
      onValueChange(next);
    },
    onBlur: () => {
      if (completeOnBlur && raw) {
        const complete = completeMoneyValue(raw, format.decimals);
        if (complete !== raw) onValueChange(complete);
      }
    },
  };
}

interface MoneyInputProps {
  label?: string;
  error?: string;
  /** Raw value: digits and "." for cents ("1250000.5"); "" when empty. */
  value: string;
  onValueChange: (value: string) => void;
  /** Currency of the amount when it isn't the format's (e.g. an account in USD). */
  currency?: string;
  format?: MoneyCountry | MoneyFormat;
  /** Show the currency code at the end (default true). */
  showCurrency?: boolean;
  completeOnBlur?: boolean;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * An amount of money, shown in the country's format while you type
 * ("$ 1'250,000.50 MXN"); the value stays raw ("1250000.50").
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
  placeholder,
  disabled,
  autoFocus,
  className,
}: MoneyInputProps) {
  const contextFormat = useMoneyFormat(currency);
  const format = formatProp ? moneyFormat(formatProp, currency) : contextFormat;
  const mask = useMoneyMask({ value, onValueChange, format, completeOnBlur });
  const [focused, setFocused] = React.useState(false);
  const placeholderColor = useToken('--on-surface-variant');
  const prefix = format.symbolPosition === 'prefix';
  const symbol = (
    <Text className="text-body-md text-on-surface-variant" importantForAccessibility="no">
      {format.symbol}
    </Text>
  );

  return (
    <Field label={label} error={error}>
      <TwView
        className={cn(
          fieldBoxClass({ focused, error, disabled }),
          'flex-row items-center gap-2 px-4',
          className,
        )}
      >
        {prefix ? symbol : null}
        <TwTextInput
          accessibilityLabel={label}
          accessibilityHint={error}
          editable={!disabled}
          autoFocus={autoFocus}
          placeholder={placeholder ?? formatMoneyText(completeMoneyValue('0', format.decimals), format)}
          placeholderTextColor={placeholderColor}
          className="min-w-0 flex-1 py-3 font-ubuntu text-base leading-none text-on-background"
          style={{ fontVariant: ['tabular-nums'] }}
          {...mask}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            mask.onBlur();
          }}
        />
        {!prefix ? symbol : null}
        {showCurrency ? (
          <Text weight="medium" className="text-xs text-on-surface-variant" importantForAccessibility="no">
            {format.currency}
          </Text>
        ) : null}
      </TwView>
    </Field>
  );
}

export { MoneyFormatProvider, MoneyInput, useMoneyFormat, useMoneyMask, type MoneyInputProps };
