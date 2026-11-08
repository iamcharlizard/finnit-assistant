import { ChevronDown, type LucideIcon } from 'lucide-react-native';

import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

/** One filter's button (it opens its sheet): its name, then a value or a count. */
export function MenuButton({
  icon,
  label,
  value,
  count = 0,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | null;
  count?: number;
  onPress: () => void;
}) {
  const on = Boolean(value) || count > 0;
  return (
    <TwPressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      onPress={onPress}
      className={cn('min-h-10 flex-row items-center gap-1.5 rounded-full border px-3', on ? 'border-brand-40 bg-brand-5' : 'border-input bg-surface')}
    >
      <Icon icon={icon} size={16} color="--on-surface-variant" />
      <Text weight="medium" className="text-sm">
        {label}
      </Text>
      {value ? <Text className="text-sm text-on-surface-variant">· {value}</Text> : null}
      {count > 0 ? (
        <TwView className="size-5 items-center justify-center rounded-full bg-brand">
          <Text weight="bold" className="text-[11px] text-brand-foreground">
            {count}
          </Text>
        </TwView>
      ) : null}
      <Icon icon={ChevronDown} size={14} color="--on-surface-variant" />
    </TwPressable>
  );
}
