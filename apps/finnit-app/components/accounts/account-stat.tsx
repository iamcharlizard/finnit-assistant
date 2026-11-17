import type { LucideIcon } from 'lucide-react-native';

import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Card } from '@finnit/ui-native/components/ui/card';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Progress } from '@finnit/ui-native/components/ui/progress';
import { Text } from '@finnit/ui-native/components/ui/text';
import { useColor } from '@finnit/ui-native/theme/theme-root';

/** One figure of the account detail: label, value and a short hint. */
export function AccountStat({
  icon,
  label,
  value,
  hint,
  tone = 'default',
  progress,
  segments,
  muted = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'expense';
  progress?: number | null;
  /** Instead of `progress`: a bar of several parts (0–100 each, of the whole bar). */
  segments?: readonly { key: string; value: number; color: string }[];
  muted?: boolean;
}) {
  const color = useColor();
  return (
    <Card className="gap-2 rounded-[20px] p-[18px]">
      <TwView className="flex-row items-center gap-2">
        <Icon icon={icon} size={16} color="--brand-ink" />
        <Text weight="medium" className="text-[11px] uppercase tracking-[0.15em] text-on-surface-variant">
          {label}
        </Text>
      </TwView>
      <Text
        weight="bold"
        className={cn(
          muted ? 'text-base text-on-surface-variant' : 'text-2xl text-on-background',
          !muted && tone === 'expense' && 'text-expense',
        )}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      {segments ? (
        <TwView className="h-2 w-full flex-row gap-[2px] overflow-hidden rounded-full bg-track">
          {segments
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <TwView key={segment.key} style={{ width: `${segment.value}%`, backgroundColor: color(segment.color) }} />
            ))}
        </TwView>
      ) : progress != null ? (
        <Progress value={progress} accessibilityLabel={label} indicatorColor={progress >= 90 ? 'var(--expense)' : undefined} />
      ) : null}
      {hint ? <Text className="text-xs text-on-surface-variant">{hint}</Text> : null}
    </Card>
  );
}
