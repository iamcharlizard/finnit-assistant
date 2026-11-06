import * as React from 'react';
import { useTranslations } from 'use-intl';

import { cn } from '@finnit/ui-native/lib/utils';
import { TwTextInput, TwView } from '@finnit/ui-native/lib/tw';
import { useToken } from '@finnit/ui-native/theme/theme-root';
import { Field } from '@finnit/ui-native/components/ui/field';
import { useMoneyFormat, useMoneyMask } from '@finnit/ui-native/components/ui/money-input';
import { Text } from '@finnit/ui-native/components/ui/text';

/** The amount, large, with the account's currency next to it (masked like MoneyInput). */
export function AmountField({
  value,
  onChange,
  currency,
  error,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  currency: string;
  error?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const t = useTranslations('newEntry.fields');
  const format = useMoneyFormat(currency);
  const mask = useMoneyMask({ value, onValueChange: onChange, format });
  const [focused, setFocused] = React.useState(false);
  const placeholder = useToken('--on-surface-variant-60');
  return (
    <Field label={t('amount')} error={error}>
      <TwView
        className={cn(
          'min-h-14 flex-row items-center gap-2 rounded-input border border-input bg-surface px-4',
          focused && 'border-ring',
          error && 'border-expense',
          className,
        )}
      >
        <Text className="text-title-lg text-on-surface-variant">{format.symbol}</Text>
        <TwTextInput
          {...mask}
          autoFocus={autoFocus}
          accessibilityLabel={t('amount')}
          placeholder={t('amountPlaceholder')}
          placeholderTextColor={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            mask.onBlur();
          }}
          className="min-w-0 flex-1 py-2 font-ubuntu-bold text-[22px] text-on-background"
          style={{ fontVariant: ['tabular-nums'] }}
        />
        <TwView className="rounded-chip bg-track px-2 py-1">
          <Text weight="medium" className="text-xs text-on-surface-variant">
            {currency}
          </Text>
        </TwView>
      </TwView>
    </Field>
  );
}
