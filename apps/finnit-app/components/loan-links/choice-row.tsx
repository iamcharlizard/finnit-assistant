import type * as React from 'react';
import { Check } from 'lucide-react-native';

import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

/** One choice of a list (a loan payment, a movement): a check, its title, details, badges and an amount. */
export function ChoiceRow({
  selected,
  title,
  meta,
  amount,
  badges,
  onPress,
  disabled = false,
}: {
  selected: boolean;
  title: string;
  meta?: string;
  amount?: string;
  badges?: React.ReactNode;
  onPress: () => void;
  /** Can't be chosen (shown for context). */
  disabled?: boolean;
}) {
  return (
    <TwPressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'min-h-11 flex-row items-center gap-3 rounded-xl border p-3',
        selected ? 'border-brand bg-brand-5' : 'border-outline active:bg-track',
        disabled && 'opacity-50',
      )}
    >
      <TwView
        className={cn(
          'size-5 items-center justify-center rounded-full border',
          selected ? 'border-brand bg-brand' : 'border-outline',
        )}
      >
        {selected ? (
          <Icon icon={Check} size={14} color="--brand-foreground" />
        ) : null}
      </TwView>
      <TwView className="min-w-0 flex-1 gap-1">
        <Text weight="medium" numberOfLines={1} className="text-sm">
          {title}
        </Text>
        {meta ? (
          <Text numberOfLines={2} className="text-xs text-on-surface-variant">
            {meta}
          </Text>
        ) : null}
        {badges ? (
          <TwView className="flex-row flex-wrap gap-1.5">{badges}</TwView>
        ) : null}
      </TwView>
      {amount ? (
        <Text
          weight="medium"
          className="text-sm"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {amount}
        </Text>
      ) : null}
    </TwPressable>
  );
}
