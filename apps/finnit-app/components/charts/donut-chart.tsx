import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

import { donutPaths, type PieSlice } from '@finnit/core/finance/pie';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { useColor, useToken } from '@finnit/ui-native/theme/theme-root';
import { Text } from '@finnit/ui-native/components/ui/text';

const SIZE = 160;
const THICKNESS = 28;
const tabular = { fontVariant: ['tabular-nums' as const] };

/**
 * A donut ("pastel") with the total in the middle and a legend naming
 * every slice with its amount and share (the web's DonutChart). Tapping a
 * legend row highlights its slice and shows it in the middle.
 */
export function DonutChart({
  title,
  slices,
  centerLabel,
  centerValue,
  countLabel,
  emptyLabel,
}: {
  title: string;
  slices: PieSlice[];
  centerLabel: string;
  centerValue: string;
  /** "4 pagos" */
  countLabel: (count: number) => string;
  emptyLabel: string;
}) {
  const color = useColor();
  const surface = useToken('--surface');
  const [active, setActive] = React.useState<string | null>(null);
  const paths = donutPaths(
    slices.map((s) => s.value),
    { size: SIZE, thickness: THICKNESS },
  );
  const shown = slices.find((s) => s.key === active);

  return (
    <TwView className="gap-3 rounded-card border border-outline bg-surface p-4">
      <Text accessibilityRole="header" weight="bold" className="text-sm">
        {title}
      </Text>
      {slices.length === 0 ? (
        <Text className="text-sm text-on-surface-variant">{emptyLabel}</Text>
      ) : (
        <>
          <TwView
            className="items-center justify-center self-center"
            style={{ width: SIZE, height: SIZE }}
            accessible
            accessibilityLabel={`${title}: ${slices.map((s) => `${s.label} ${s.amount} (${s.percent}%)`).join(', ')}`}
          >
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: 'absolute' }}>
              {slices.map((slice, i) => (
                <Path
                  key={slice.key}
                  d={paths[i]}
                  fill={color(slice.color)}
                  stroke={surface}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  opacity={active && active !== slice.key ? 0.35 : 1}
                />
              ))}
            </Svg>
            <TwView className="items-center px-8">
              <Text weight="bold" className="text-base" style={tabular}>
                {shown ? shown.amount : centerValue}
              </Text>
              <Text numberOfLines={2} className="text-center text-[11px] text-on-surface-variant">
                {shown ? `${shown.label} · ${shown.percent}%` : centerLabel}
              </Text>
            </TwView>
          </TwView>
          <TwView className="gap-1">
            {slices.map((slice) => (
              <TwPressable
                key={slice.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active === slice.key }}
                accessibilityLabel={`${slice.label}, ${slice.amount}, ${slice.percent}%`}
                onPress={() => setActive((current) => (current === slice.key ? null : slice.key))}
                className={cn('flex-row items-center gap-2 rounded-lg px-2 py-1.5', active === slice.key && 'bg-track')}
              >
                <TwView className="size-2.5 rounded-full" style={{ backgroundColor: color(slice.color) }} />
                <Text numberOfLines={1} className="min-w-0 flex-1 text-xs">
                  {slice.label}
                  <Text className="text-xs text-on-surface-variant">{`  ${countLabel(slice.count)}`}</Text>
                </Text>
                <Text weight="medium" className="text-xs" style={tabular}>
                  {slice.amount}
                </Text>
                <Text className="w-10 text-right text-xs text-on-surface-variant" style={tabular}>
                  {slice.percent}%
                </Text>
              </TwPressable>
            ))}
          </TwView>
        </>
      )}
    </TwView>
  );
}
