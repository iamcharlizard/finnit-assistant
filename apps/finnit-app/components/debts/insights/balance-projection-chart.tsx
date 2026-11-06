import * as React from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { useTranslations } from 'use-intl';

import type { ProjectionPoint } from '@finnit/core/debts/insights-view';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { useToken } from '@finnit/ui-native/theme/theme-root';
import { Text } from '@finnit/ui-native/components/ui/text';

const HEIGHT = 160;
const PAD = 8;

/**
 * What will still be owed at the end of each coming month. Touch and drag
 * to read a month (the web's crosshair).
 */
export function BalanceProjectionChart({
  points,
  paidOffLabel,
  className,
}: {
  points: ProjectionPoint[];
  paidOffLabel: string | null;
  className?: string;
}) {
  const t = useTranslations('debts.insights');
  const [width, setWidth] = React.useState(0);
  const [active, setActive] = React.useState<number | null>(null);
  const series = useToken('--chart-1');
  const outline = useToken('--outline');
  const muted = useToken('--on-surface-variant');
  if (points.length === 0) return null;

  const max = Math.max(1, ...points.map((p) => p.value));
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const x = (i: number) => i * step;
  const y = (v: number) => PAD + (1 - v / max) * (HEIGHT - 2 * PAD);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
  const pick = (event: GestureResponderEvent) => {
    if (width <= 0) return;
    const ratio = event.nativeEvent.locationX / width;
    setActive(Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1)))));
  };
  const hovered = active !== null ? points[active]! : null;
  const last = points[points.length - 1]!;

  return (
    <TwView className={cn('gap-3 rounded-card border border-outline bg-surface p-4', className)}>
      <TwView className="gap-0.5">
        <Text accessibilityRole="header" weight="bold" className="text-sm">
          {t('projectionTitle')}
        </Text>
        <Text className="text-xs text-on-surface-variant">
          {paidOffLabel
            ? t('projectionPaidOff', { month: paidOffLabel })
            : t('projectionNotPaidOff', { count: points.length })}
        </Text>
      </TwView>
      <TwView className="min-h-6 flex-row items-baseline justify-between">
        {hovered ? (
          <>
            <Text className="text-xs text-on-surface-variant">{hovered.label}</Text>
            <Text weight="bold" className="text-sm">
              {t('owedThen')}: {hovered.amount}
            </Text>
          </>
        ) : null}
      </TwView>
      <TwView
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('projectionLabel', { from: points[0]!.amount, to: last.amount, month: last.label })}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderRelease={() => setActive(null)}
        onResponderTerminate={() => setActive(null)}
        style={{ height: HEIGHT }}
      >
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            <Line x1={0} x2={width} y1={HEIGHT - PAD} y2={HEIGHT - PAD} stroke={outline} />
            <Path d={`${path} L${width},${HEIGHT - PAD} L0,${HEIGHT - PAD} Z`} fill={series} fillOpacity={0.12} />
            <Path d={path} fill="none" stroke={series} strokeWidth={2} strokeLinejoin="round" />
            {active !== null ? (
              <Line x1={x(active)} x2={x(active)} y1={PAD} y2={HEIGHT - PAD} stroke={muted} strokeDasharray="3 3" />
            ) : null}
          </Svg>
        ) : null}
      </TwView>
      <TwView className="flex-row justify-between" importantForAccessibility="no-hide-descendants">
        <Text className="text-[10px] text-on-surface-variant">{points[0]!.label}</Text>
        <Text className="text-[10px] text-on-surface-variant">
          {points[Math.floor((points.length - 1) / 2)]!.label}
        </Text>
        <Text className="text-[10px] text-on-surface-variant">{last.label}</Text>
      </TwView>
    </TwView>
  );
}
