import type * as React from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';

import { cn } from '../../lib/utils';
import { TwPressable, TwView } from '../../lib/tw';
import { Icon } from '../ui/icon';
import { Text } from '../ui/text';

/** One setting: label, description and its control (@finnit/ui's SettingRow). With onPress, a link row with a chevron. */
function SettingRow({
  label,
  icon,
  description,
  children,
  onPress,
  className,
}: {
  label: string;
  icon?: LucideIcon;
  description?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  className?: string;
}) {
  const body = (
    <>
      <TwView className="min-w-0 flex-1 flex-row items-center gap-3">
        {icon ? <Icon icon={icon} size={20} color="--on-surface-variant" /> : null}
        <TwView className="min-w-0 flex-1">
          <Text className={cn('text-base', description ? 'text-on-background' : 'text-on-surface-variant')}>{label}</Text>
          {description ? (
            <Text className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-on-surface-variant">{description}</Text>
          ) : null}
        </TwView>
      </TwView>
      {children ?? (onPress ? <Icon icon={ChevronRight} size={16} color="--on-surface-variant" /> : null)}
    </>
  );
  const classes = cn('min-h-[52px] flex-row items-center justify-between gap-3 rounded-xl bg-track px-3 py-2', className);
  return onPress ? (
    <TwPressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className={cn(classes, 'active:bg-accent')}>
      {body}
    </TwPressable>
  ) : (
    <TwView className={classes}>{body}</TwView>
  );
}

export { SettingRow };
