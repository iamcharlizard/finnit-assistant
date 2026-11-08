import type * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

/**
 * A collapsible group inside a filter sheet (the web's FilterSection): its
 * title, with how many values are chosen, toggles the body.
 */
export function FilterSection({
  title,
  count = 0,
  open,
  onToggle,
  children,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <TwView className="border-b border-outline-variant">
      <TwPressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        className="min-h-12 flex-row items-center gap-2 px-1"
      >
        <Text accessibilityRole="header" weight="medium" className="flex-1 text-sm">
          {title}
        </Text>
        {count > 0 ? (
          <TwView className="size-5 items-center justify-center rounded-full bg-brand">
            <Text weight="bold" className="text-[11px] text-brand-foreground">
              {String(count)}
            </Text>
          </TwView>
        ) : null}
        <Icon icon={open ? ChevronUp : ChevronDown} size={18} color="--on-surface-variant" />
      </TwPressable>
      {open ? <TwView className="gap-1 pb-3">{children}</TwView> : null}
    </TwView>
  );
}
