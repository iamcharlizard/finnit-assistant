import type { LucideIcon } from 'lucide-react-native';

import { withAlpha } from '../../lib/color';
import { cn } from '../../lib/utils';
import { TwPressable, TwView } from '../../lib/tw';
import { useColor } from '../../theme/theme-root';
import { Text } from '../ui/text';

/** A category's amount with its share as a bar (@finnit/ui's CategoryProgressItem). */
function CategoryProgressItem({
  label,
  amount,
  progressPercent,
  icon: Glyph,
  accentColor,
  onPress,
  className,
}: {
  label: string;
  amount: string;
  progressPercent: number;
  icon: LucideIcon;
  accentColor: string;
  onPress?: () => void;
  className?: string;
}) {
  const color = useColor()(accentColor);
  const clamped = Math.min(100, Math.max(0, progressPercent));
  return (
    <TwPressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}, ${amount}`}
      onPress={onPress}
      disabled={!onPress}
      className={cn('min-h-11 w-full flex-row items-center gap-4 rounded-2xl border border-glass-border bg-glass p-4 active:bg-accent', className)}
    >
      <TwView
        className="size-12 shrink-0 items-center justify-center rounded-full border"
        style={{ backgroundColor: withAlpha(color, 0.12), borderColor: withAlpha(color, 0.2) }}
      >
        <Glyph size={22} color={color} />
      </TwView>
      <TwView className="flex-1">
        <TwView className="mb-2 flex-row justify-between gap-2">
          <Text weight="medium" numberOfLines={1} className="shrink text-[15px]">
            {label}
          </Text>
          <Text weight="bold" className="text-[15px]">
            {amount}
          </Text>
        </TwView>
        <TwView className="h-[5px] w-full overflow-hidden rounded-full bg-track">
          <TwView className="h-full rounded-full" style={{ width: `${clamped}%`, backgroundColor: color }} />
        </TwView>
      </TwView>
    </TwPressable>
  );
}

export { CategoryProgressItem };
