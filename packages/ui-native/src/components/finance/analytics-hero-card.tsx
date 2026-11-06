import { ArrowDownRight, ArrowUpRight } from 'lucide-react-native';

import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { Icon } from '../ui/icon';
import { Text } from '../ui/text';

interface SparkBar {
  heightPercent: number;
  highlighted?: boolean;
}

/** The month's spending with its trend and a small bar chart (@finnit/ui's AnalyticsHeroCard). */
function AnalyticsHeroCard({
  label = 'Total spending',
  amount,
  trendPercent,
  trendDown = true,
  sparkBars = [],
  trendDownLabel = 'Down',
  trendUpLabel = 'Up',
  className,
}: {
  label?: string;
  amount: string;
  trendPercent?: string;
  trendDown?: boolean;
  sparkBars?: SparkBar[];
  trendDownLabel?: string;
  trendUpLabel?: string;
  className?: string;
}) {
  return (
    <TwView className={cn('overflow-hidden rounded-2xl border border-glass-border bg-glass p-5', className)}>
      <TwView className="absolute -right-8 -top-8 size-24 rounded-full bg-[rgba(108,114,203,0.15)]" />
      <TwView className="mb-4 flex-row items-start justify-between">
        <TwView className="flex-1">
          <Text className="mb-1 text-[13px] text-on-surface-variant">{label}</Text>
          <Text weight="bold" numberOfLines={1} adjustsFontSizeToFit className="text-[32px]" style={{ lineHeight: 40 }}>
            {amount}
          </Text>
        </TwView>
        {trendPercent ? (
          <TwView
            accessible
            accessibilityLabel={`${trendDown ? trendDownLabel : trendUpLabel} ${trendPercent}`}
            className="flex-row items-center gap-1 rounded-lg bg-tertiary-12 px-2 py-1"
          >
            <Icon icon={trendDown ? ArrowDownRight : ArrowUpRight} size={12} color="--tertiary" />
            <Text weight="bold" className="text-[13px] text-tertiary">
              {trendPercent}
            </Text>
          </TwView>
        ) : null}
      </TwView>
      <TwView importantForAccessibility="no-hide-descendants" className="h-16 flex-row items-end gap-1">
        {sparkBars.map((bar, i) => (
          <TwView
            key={i}
            className={cn('flex-1 rounded-t-[3px]', bar.highlighted ? 'bg-[rgba(108,114,203,0.55)]' : 'bg-[rgba(108,114,203,0.22)]')}
            style={{ height: `${bar.heightPercent}%` }}
          />
        ))}
      </TwView>
    </TwView>
  );
}

export { AnalyticsHeroCard, type SparkBar };
