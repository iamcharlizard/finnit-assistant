import * as React from 'react';
import Svg, { Circle } from 'react-native-svg';

import { cn } from '../../lib/utils';
import { TwPressable, TwView } from '../../lib/tw';
import { useColor, useToken } from '../../theme/theme-root';
import { Text } from '../ui/text';

interface DonutSlice {
  id: string;
  label: string;
  /** Share of the whole, 0–100. */
  percent: number;
  amount: string;
  percentage: string;
  /** A color or a theme variable (`var(--outline)`). */
  color: string;
}

const STROKE = 18;
const GAP = 2;

/**
 * A donut of shares with its legend (@finnit/ui's CategoryDonut): the total
 * in the center; tapping a slice or its legend row shows its name, amount
 * and share there instead.
 */
function CategoryDonut({
  slices,
  totalLabel,
  total,
  summary,
  size = 168,
  className,
}: {
  slices: ReadonlyArray<DonutSlice>;
  totalLabel: string;
  total: string;
  summary: string;
  size?: number;
  className?: string;
}) {
  const color = useColor();
  const track = useToken('--track');
  const [active, setActive] = React.useState<string | null>(null);
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const gap = slices.length > 1 ? GAP : 0;
  const shown = slices.find((s) => s.id === active) ?? null;
  const toggle = (id: string) => setActive((current) => (current === id ? null : id));

  let offset = 0;
  const arcs = slices.map((slice) => {
    const length = (slice.percent / 100) * circumference;
    const arc = { slice, dash: Math.max(0, length - gap), offset };
    offset += length;
    return arc;
  });

  return (
    <TwView className={cn('items-center gap-5', className)}>
      <TwView accessible accessibilityRole="image" accessibilityLabel={summary} style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={center} cy={center} r={radius} stroke={track} strokeWidth={STROKE} fill="none" />
          {arcs.map(({ slice, dash, offset: start }) => (
            <Circle
              key={slice.id}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={color(slice.color)}
              strokeWidth={active === slice.id ? STROKE + 4 : STROKE}
              strokeDasharray={`${dash} ${circumference}`}
              strokeDashoffset={-start}
              opacity={active && active !== slice.id ? 0.45 : 1}
              onPress={() => toggle(slice.id)}
            />
          ))}
        </Svg>
        <TwView pointerEvents="none" className="absolute inset-0 items-center justify-center px-6">
          <Text numberOfLines={2} className="text-center text-xs text-on-surface-variant">
            {shown ? shown.label : totalLabel}
          </Text>
          <Text weight="bold" className="text-base" style={{ fontVariant: ['tabular-nums'] }}>
            {shown ? shown.amount : total}
          </Text>
          {shown ? <Text className="text-xs text-on-surface-variant">{shown.percentage}</Text> : null}
        </TwView>
      </TwView>

      <TwView className="w-full gap-1">
        {slices.map((slice) => (
          <TwPressable
            key={slice.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active === slice.id }}
            onPress={() => toggle(slice.id)}
            className={cn('min-h-10 flex-row items-center gap-3 rounded-lg px-2', active === slice.id && 'bg-track')}
          >
            <TwView className="size-2.5 rounded-full" style={{ backgroundColor: color(slice.color) }} />
            <Text numberOfLines={1} className="flex-1 text-sm">
              {slice.label}
            </Text>
            <Text className="text-xs text-on-surface-variant" style={{ fontVariant: ['tabular-nums'] }}>
              {slice.amount}
            </Text>
            <Text weight="medium" className="w-10 text-right text-xs text-on-surface-variant">
              {slice.percentage}
            </Text>
          </TwPressable>
        ))}
      </TwView>
    </TwView>
  );
}

export { CategoryDonut, type DonutSlice };
