import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { useColor } from '../../theme/theme-root';

interface ProgressProps {
  /** 0–100 (clamped). */
  value: number;
  /** Any color for the bar, also `var(--chart-1)` (defaults to the accent). */
  indicatorColor?: string;
  className?: string;
  /** Read by screen readers, e.g. "62% of the budget". */
  accessibilityLabel?: string;
}

function Progress({ value, indicatorColor, className, accessibilityLabel }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const color = useColor();
  return (
    <TwView
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-track', className)}
    >
      <TwView
        className={cn('h-full rounded-full', !indicatorColor && 'bg-accent-neon')}
        style={{ width: `${clamped}%`, backgroundColor: indicatorColor ? color(indicatorColor) : undefined }}
      />
    </TwView>
  );
}

export { Progress, type ProgressProps };
