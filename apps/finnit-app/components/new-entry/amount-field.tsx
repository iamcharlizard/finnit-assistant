import * as React from 'react';
import * as Haptics from 'expo-haptics';
import { useTranslations } from 'use-intl';

import { CalculatorInput } from '@finnit/ui-native/components/ui/calculator-input';

/**
 * The amount, large, with the account's currency next to it, typed on the
 * calculator keypad (+ − × ÷ =) instead of the system keyboard.
 */
export function AmountField({
  value,
  onChange,
  currency,
  error,
  autoFocus,
  onDone,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  currency: string;
  error?: string;
  /** Open the keypad when the form shows. */
  autoFocus?: boolean;
  /** After "Listo": e.g. go to the next field. */
  onDone?: () => void;
  className?: string;
}) {
  const t = useTranslations('newEntry');
  const labels = React.useMemo(
    () => ({
      open: t('calculator.open'),
      done: t('calculator.done'),
      clear: t('calculator.clear'),
      backspace: t('calculator.backspace'),
      plus: t('calculator.plus'),
      minus: t('calculator.minus'),
      times: t('calculator.times'),
      divide: t('calculator.divide'),
      equals: t('calculator.equals'),
      decimal: t('calculator.decimal'),
      invalid: t('calculator.invalid'),
    }),
    [t],
  );
  return (
    <CalculatorInput
      label={t('fields.amount')}
      value={value}
      onValueChange={onChange}
      currency={currency}
      error={error}
      autoOpen={autoFocus}
      onDone={onDone}
      onKeyPress={() => void Haptics.selectionAsync()}
      labels={labels}
      className={className}
    />
  );
}
