import type { LucideIcon } from 'lucide-react-native';

import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Card } from '@finnit/ui-native/components/ui/card';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Progress } from '@finnit/ui-native/components/ui/progress';
import { Text } from '@finnit/ui-native/components/ui/text';

/** One figure of the account detail: label, value and a short hint. */
export function AccountStat({
  icon,
  label,
  value,
  hint,
  tone = 'default',
  progress,
  muted = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'expense';
  progress?: number | null;
  muted?: boolean;
}) {
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
      {progress != null ? (
        <Progress value={progress} accessibilityLabel={label} indicatorColor={progress >= 90 ? 'var(--expense)' : undefined} />
      ) : null}
      {hint ? <Text className="text-xs text-on-surface-variant">{hint}</Text> : null}
    </Card>
  );
}
