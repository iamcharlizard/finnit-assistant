import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { Text } from '../ui/text';
import { DonutRing } from './donut-ring';

/** Savings rate as a ring with its rating (@finnit/ui's FinancialHealthChart). */
function FinancialHealthChart({
  percentage,
  label,
  rating,
  caption,
  className,
}: {
  percentage: number;
  label: string;
  rating: string;
  caption: string;
  className?: string;
}) {
  return (
    <TwView className={cn('items-center rounded-2xl border border-glass-border bg-glass p-5', className)}>
      <Text weight="medium" className="mb-5 self-start text-[15px] text-on-surface-variant">
        {label}
      </Text>
      <TwView
        accessibilityRole="progressbar"
        accessibilityLabel={`${label}: ${percentage}%`}
        accessibilityValue={{ min: 0, max: 100, now: percentage }}
        className="mb-4 items-center justify-center"
        style={{ width: 140, height: 140 }}
      >
        <DonutRing percentage={percentage} />
        <TwView className="absolute inset-0 items-center justify-center">
          <Text weight="bold" className="text-[26px]" style={{ lineHeight: 32 }}>
            {percentage}%
          </Text>
          <Text className="mt-0.5 text-xs text-tertiary">{rating}</Text>
        </TwView>
      </TwView>
      <Text className="px-2 text-center text-[13px] text-on-surface-variant" style={{ lineHeight: 20 }}>
        {caption}
      </Text>
    </TwView>
  );
}

export { FinancialHealthChart };
