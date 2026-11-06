import * as React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTranslations } from 'use-intl';

import type { AnalyticsView } from '@finnit/core/analytics/view';
import { TwView } from '@finnit/ui-native/lib/tw';
import { useToken } from '@finnit/ui-native/theme/theme-root';
import { Text } from '@finnit/ui-native/components/ui/text';

const HEIGHT = 110;

function linePath(values: number[], width: number): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${Math.round(i * step)},${Math.round(HEIGHT - 8 - ((v - min) / span) * (HEIGHT - 16))}`)
    .join(' ');
}

/** Projected total balance for the next months. */
export function CashFlowProjection({ points }: { points: AnalyticsView['projection'] }) {
  const t = useTranslations('analytics.projection');
  const [width, setWidth] = React.useState(0);
  const tertiary = useToken('--tertiary');
  if (points.length === 0) return null;
  const last = points[points.length - 1]!;
  const path = width > 0 ? linePath(points.map((p) => p.value), width) : '';
  return (
    <TwView className="overflow-hidden rounded-2xl border border-glass-border bg-glass p-5">
      <Text accessibilityRole="header" weight="bold" className="mb-1 text-lg">
        {t('title')}
      </Text>
      <Text className="mb-4 text-[13px] text-on-surface-variant">
        {t.rich('description', {
          month: last.label,
          balance: last.balance,
          strong: (chunks) => (
            <Text weight="bold" className="text-[13px] text-on-background">
              {chunks}
            </Text>
          ),
        })}
      </Text>
      <TwView importantForAccessibility="no-hide-descendants" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}>
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="cashflow" x1="0" x2="0" y1="0" y2="1">
                <Stop offset="0" stopColor={tertiary} stopOpacity={0.15} />
                <Stop offset="1" stopColor={tertiary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={`${path} L${width},${HEIGHT} L0,${HEIGHT} Z`} fill="url(#cashflow)" />
            <Path d={path} fill="none" stroke={tertiary} strokeWidth={2.5} strokeLinecap="round" />
          </Svg>
        ) : null}
      </TwView>
      <TwView className="mt-3 flex-row flex-wrap">
        {points.map((p) => (
          <TwView key={p.label} className="mb-2 pr-2" style={{ width: '33.33%' }}>
            <Text className="text-[11px] text-on-surface-variant">{p.label}</Text>
            <Text weight="medium" numberOfLines={1} className="text-xs">
              {p.balance}
            </Text>
          </TwView>
        ))}
      </TwView>
    </TwView>
  );
}
