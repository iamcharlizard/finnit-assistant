import type { StyleProp, ViewStyle } from 'react-native';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  type LucideIcon,
} from 'lucide-react-native';

import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { useColor } from '../../theme/theme-root';
import { Text } from '../ui/text';
import { Sparkline } from './sparkline';

interface StatTileTrend {
  /** "+12.5%". */
  label: string;
  direction: 'up' | 'down' | 'flat';
  tone: 'positive' | 'negative' | 'neutral';
}

interface StatTileProps {
  icon: LucideIcon;
  /** The tile's accent, e.g. `var(--chart-1)`. */
  color: string;
  label: string;
  value: string;
  trend?: StatTileTrend | null;
  compareLabel?: string | null;
  caption?: string | null;
  spark?: ReadonlyArray<number>;
  /** Screen-reader text for the trend ("Subió 12.5% vs mes anterior"). */
  trendLabel?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

const TREND_ICON = { up: ArrowUp, down: ArrowDown, flat: ArrowRight };
const TONE_CLASS = {
  positive: 'text-income',
  negative: 'text-expense',
  neutral: 'text-on-surface-variant',
};
const TONE_TOKEN = {
  positive: 'var(--income)',
  negative: 'var(--expense)',
  neutral: 'var(--on-surface-variant)',
};

/** "#2a78d6" at 16 % opacity; other colors as they are. */
function tint(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}29` : color;
}

/**
 * One analytics figure (@finnit/ui's StatTile): a tinted icon, the label,
 * the amount, how it changed and a mini trend chart.
 */
function StatTile({
  icon: Glyph,
  color,
  label,
  value,
  trend,
  compareLabel,
  caption,
  spark = [],
  trendLabel,
  className,
  style,
}: StatTileProps) {
  const resolve = useColor();
  const accent = resolve(color);
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;
  return (
    <TwView
      accessible
      accessibilityLabel={[label, value, trendLabel ?? caption]
        .filter(Boolean)
        .join(', ')}
      className={cn(
        'gap-3 rounded-card border border-outline-variant bg-surface p-4',
        className,
      )}
      style={style}
    >
      <TwView className="flex-row items-start justify-between gap-2">
        <TwView
          className="size-10 items-center justify-center rounded-2xl"
          style={{ backgroundColor: tint(accent) }}
        >
          <Glyph size={20} color={accent} />
        </TwView>
        <Sparkline values={spark} color={accent} width={64} height={32} />
      </TwView>
      <TwView className="gap-0.5">
        <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">
          {label}
        </Text>
        <Text
          weight="bold"
          numberOfLines={1}
          adjustsFontSizeToFit
          className="text-xl text-on-background"
        >
          {value}
        </Text>
      </TwView>
      <TwView className="min-h-4 flex-row flex-wrap items-center gap-x-1.5">
        {trend && TrendIcon ? (
          <>
            <TwView className="flex-row items-center gap-0.5">
              <TrendIcon size={12} color={resolve(TONE_TOKEN[trend.tone])} />
              <Text
                weight="bold"
                className={cn('text-[11px]', TONE_CLASS[trend.tone])}
              >
                {trend.label}
              </Text>
            </TwView>
            {compareLabel ? (
              <Text className="text-[11px] text-on-surface-variant">
                {compareLabel}
              </Text>
            ) : null}
          </>
        ) : caption ? (
          <Text weight="medium" className="text-[11px] text-on-surface-variant">
            {caption}
          </Text>
        ) : null}
      </TwView>
    </TwView>
  );
}

export { StatTile, type StatTileProps, type StatTileTrend };
