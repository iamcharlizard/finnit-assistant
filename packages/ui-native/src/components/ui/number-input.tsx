import * as React from 'react';

import { sanitizeNumberText, type NumberRules } from '@finnit/core/format/number-format';

import { cn } from '../../lib/utils';
import { TwTextInput, TwView } from '../../lib/tw';
import { useToken } from '../../theme/theme-root';
import { Field, fieldBoxClass } from './field';
import { Text } from './text';

interface NumberInputProps extends NumberRules {
  label?: string;
  error?: string;
  /** Raw value ("12", "12.5", "-3"); "" when empty. */
  value: string;
  onValueChange: (value: string) => void;
  /** Text after the number, e.g. "%". */
  suffix?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * @finnit/ui's NumberInput: rates, counts, days. Never letters; whole
 * numbers unless `decimals`.
 */
function NumberInput({
  label,
  error,
  value,
  onValueChange,
  suffix,
  placeholder,
  disabled,
  className,
  decimals = 0,
  allowNegative = false,
  maxDigits,
}: NumberInputProps) {
  const [focused, setFocused] = React.useState(false);
  const placeholderColor = useToken('--on-surface-variant');
  return (
    <Field label={label} error={error}>
      <TwView
        className={cn(
          fieldBoxClass({ focused, error, disabled }),
          'flex-row items-center gap-2 px-4',
          className,
        )}
      >
        <TwTextInput
          accessibilityLabel={label}
          accessibilityHint={error}
          editable={!disabled}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          keyboardType={
            allowNegative ? 'numbers-and-punctuation' : decimals > 0 ? 'decimal-pad' : 'number-pad'
          }
          onChangeText={(text) =>
            onValueChange(sanitizeNumberText(text, { decimals, allowNegative, maxDigits }))
          }
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="min-w-0 flex-1 py-3 font-ubuntu text-base leading-none text-on-background"
          style={{ fontVariant: ['tabular-nums'] }}
        />
        {suffix ? (
          <Text className="text-body-md text-on-surface-variant" importantForAccessibility="no">
            {suffix}
          </Text>
        ) : null}
      </TwView>
    </Field>
  );
}

export { NumberInput, type NumberInputProps };
