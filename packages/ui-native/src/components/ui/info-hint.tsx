import * as React from 'react';
import { Info, type LucideIcon } from 'lucide-react-native';

import { TwPressable, TwView } from '../../lib/tw';
import { Icon } from './icon';
import { Sheet } from './sheet';
import { Text } from './text';

interface InfoHintProps {
  /** Screen reader label of the icon, and the sheet's title. */
  label: string;
  /** A paragraph of help. */
  text?: string;
  /** Or a list (e.g. what a payment covers). */
  items?: string[];
  closeLabel?: string;
  /** Another icon than the info one (e.g. a question mark for a screen's help). */
  icon?: LucideIcon;
  iconSize?: number;
  /** The trigger instead of the info icon (e.g. a "+2" chip). */
  children?: React.ReactNode;
}

/**
 * The web's InfoHint: help next to a figure without an always-visible
 * paragraph. Touch has no hover, so the icon (or `children`) opens a small
 * sheet with the text or the list.
 */
function InfoHint({ label, text, items, closeLabel, icon = Info, iconSize = 16, children }: InfoHintProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <TwPressable
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        onPress={() => setOpen(true)}
        className="items-center justify-center active:opacity-60"
      >
        {children ?? <Icon icon={icon} size={iconSize} color="--on-surface-variant" />}
      </TwPressable>
      <Sheet open={open} onOpenChange={setOpen} title={label} closeLabel={closeLabel}>
        <TwView className="gap-2 pb-2">
          {text ? <Text className="text-sm text-on-surface-variant">{text}</Text> : null}
          {items?.map((item, index) => (
            <Text key={index} className="text-sm" style={{ fontVariant: ['tabular-nums'] }}>
              {item}
            </Text>
          ))}
        </TwView>
      </Sheet>
    </>
  );
}

export { InfoHint, type InfoHintProps };
