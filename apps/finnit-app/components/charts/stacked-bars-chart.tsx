import * as React from 'react';

import type { StackedBar } from '@finnit/core/finance/stacked-bars';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { useColor } from '@finnit/ui-native/theme/theme-root';
import { Text } from '@finnit/ui-native/components/ui/text';

const tabular = { fontVariant: ['tabular-nums' as const] };

export interface StackedSeries {
  key: string;
  label: string;
  /** A chart token, e.g. 'var(--chart-1)'. */
  color: string;
}

/**
 * Vertical bars stacked by series (the web's StackedBarsChart): a legend,
 * and a tap on a bar shows its numbers below. Series without values are
 * left out.
 */
export function StackedBarsChart({
  title,
  note,
  bars,
  series: allSeries,
  labels,
}: {
  title: string;
  note?: string;
  bars: StackedBar[];
  series: readonly StackedSeries[];
  labels: { bar: (bar: StackedBar) => string; total: string; empty: string };
}) {
  const color = useColor();
  const [active, setActive] = React.useState<string | null>(null);
  const series = allSeries.filter((s) => bars.some((b) => b.segments.some((x) => x.key === s.key && x.value > 0)));
  const colorOf = (key: string) => color(allSeries.find((s) => s.key === key)?.color ?? 'var(--chart-1)');
  const labelOf = (key: string) => allSeries.find((s) => s.key === key)?.label ?? key;
  const shown = (bar: StackedBar) => bar.segments.filter((s) => series.some((x) => x.key === s.key));
  const chosen = bars.find((b) => b.key === active);
  const empty = bars.every((b) => b.value === 0);

  return (
    <TwView className="gap-3 rounded-card border border-outline bg-surface p-4">
      <Text accessibilityRole="header" weight="bold" className="text-sm">
        {title}
      </Text>
      {empty ? (
        <Text className="text-sm text-on-surface-variant">{labels.empty}</Text>
      ) : (
        <>
          <TwView className="flex-row flex-wrap gap-3">
            {series.map((s) => (
              <TwView key={s.key} className="flex-row items-center gap-1">
                <TwView className="size-2 rounded-full" style={{ backgroundColor: color(s.color) }} />
                <Text className="text-[11px] text-on-surface-variant">{s.label}</Text>
              </TwView>
            ))}
          </TwView>
          <TwView className="h-40 flex-row items-end gap-2 border-b border-outline">
            {bars.map((bar) => (
              <TwPressable
                key={bar.key}
                accessibilityRole="button"
                accessibilityLabel={labels.bar(bar)}
                accessibilityState={{ selected: active === bar.key }}
                onPress={() => setActive((current) => (current === bar.key ? null : bar.key))}
                className="h-full flex-1 justify-end"
              >
                <TwView
                  className="w-full flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px]"
                  style={{ height: `${bar.percent}%`, opacity: active && active !== bar.key ? 0.45 : 1 }}
                >
                  {shown(bar)
                    .filter((segment) => segment.value > 0)
                    .map((segment) => (
                      <TwView key={segment.key} style={{ flexGrow: segment.value, flexBasis: 0, minHeight: 2, backgroundColor: colorOf(segment.key) }} />
                    ))}
                </TwView>
              </TwPressable>
            ))}
          </TwView>
          <TwView className="-mt-1 flex-row gap-2">
            {bars.map((bar) => (
              <Text key={bar.key} numberOfLines={1} className="flex-1 text-center text-[11px] text-on-surface-variant">
                {bar.label}
              </Text>
            ))}
          </TwView>
          {chosen ? (
            <TwView className="gap-1 rounded-input bg-track p-3">
              <Text weight="bold" className="text-xs">
                {chosen.label}
              </Text>
              {shown(chosen).map((segment) => (
                <TwView key={segment.key} className="flex-row items-center gap-2">
                  <TwView className="size-2 rounded-full" style={{ backgroundColor: colorOf(segment.key) }} />
                  <Text className="flex-1 text-xs text-on-surface-variant">{labelOf(segment.key)}</Text>
                  <Text weight="medium" className="text-xs" style={tabular}>
                    {segment.amount}
                  </Text>
                </TwView>
              ))}
              <TwView className="flex-row items-center gap-2">
                <Text className="flex-1 text-xs text-on-surface-variant">{labels.total}</Text>
                <Text weight="bold" className="text-xs" style={tabular}>
                  {chosen.total}
                </Text>
              </TwView>
            </TwView>
          ) : null}
        </>
      )}
      {note ? <Text className="text-xs text-on-surface-variant">{note}</Text> : null}
    </TwView>
  );
}
