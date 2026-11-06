import * as React from 'react';
import { useTranslations } from 'use-intl';
import { CircleAlert, CircleCheck, Clock, type LucideIcon } from 'lucide-react-native';

import {
  MONTH_SERIES,
  SERIES_COLOR,
  type Bar,
  type CalendarSummary,
  type MonthBar,
  type ProgressPart,
} from '@finnit/core/calendar/summary';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { useColor } from '@finnit/ui-native/theme/theme-root';
import { Text } from '@finnit/ui-native/components/ui/text';

const tabular = { fontVariant: ['tabular-nums' as const] };

function ChartCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <TwView className="gap-3 rounded-card border border-outline bg-surface p-4">
      <Text accessibilityRole="header" weight="bold" className="text-sm">
        {title}
      </Text>
      {children}
      {note ? <Text className="text-xs text-on-surface-variant">{note}</Text> : null}
    </TwView>
  );
}

/** What is due each of the next months, stacked by series; tap a month for its numbers. */
export function MonthsChart({ months, hasCardEstimate }: { months: MonthBar[]; hasCardEstimate: boolean }) {
  const t = useTranslations('calendar.summary');
  const color = useColor();
  const [active, setActive] = React.useState<string | null>(null);
  const series = MONTH_SERIES.filter((s) => months.some((m) => m.segments.some((x) => x.series === s && x.value > 0)));
  const chosen = months.find((m) => m.key === active);
  const empty = months.every((m) => m.value === 0);

  return (
    <ChartCard title={t('monthsTitle', { count: months.length })} note={hasCardEstimate ? t('monthsHint') : undefined}>
      {empty ? (
        <Text className="text-sm text-on-surface-variant">{t('empty')}</Text>
      ) : (
        <>
          <TwView className="flex-row flex-wrap gap-3">
            {series.map((s) => (
              <TwView key={s} className="flex-row items-center gap-1">
                <TwView className="size-2 rounded-full" style={{ backgroundColor: color(SERIES_COLOR[s]) }} />
                <Text className="text-[11px] text-on-surface-variant">{t(`series.${s}`)}</Text>
              </TwView>
            ))}
          </TwView>
          <TwView className="h-40 flex-row items-end gap-2 border-b border-outline">
            {months.map((month) => (
              <TwPressable
                key={month.key}
                accessibilityRole="button"
                accessibilityLabel={t('monthLabel', { month: month.label, amount: month.total })}
                accessibilityState={{ selected: active === month.key }}
                onPress={() => setActive((current) => (current === month.key ? null : month.key))}
                className="h-full flex-1 justify-end"
              >
                <TwView
                  className="w-full flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px]"
                  style={{ height: `${month.percent}%`, opacity: active && active !== month.key ? 0.45 : 1 }}
                >
                  {month.segments
                    .filter((segment) => segment.value > 0)
                    .map((segment) => (
                      <TwView
                        key={segment.series}
                        style={{ flexGrow: segment.value, flexBasis: 0, minHeight: 2, backgroundColor: color(SERIES_COLOR[segment.series]) }}
                      />
                    ))}
                </TwView>
              </TwPressable>
            ))}
          </TwView>
          <TwView className="-mt-1 flex-row gap-2">
            {months.map((month) => (
              <Text key={month.key} className="flex-1 text-center text-[11px] text-on-surface-variant">
                {month.label}
              </Text>
            ))}
          </TwView>
          {chosen ? (
            <TwView className="gap-1 rounded-input bg-track p-3">
              <Text weight="bold" className="text-xs">
                {chosen.label}
              </Text>
              {chosen.segments
                .filter((s) => series.includes(s.series))
                .map((segment) => (
                  <TwView key={segment.series} className="flex-row items-center gap-2">
                    <TwView className="size-2 rounded-full" style={{ backgroundColor: color(SERIES_COLOR[segment.series]) }} />
                    <Text className="flex-1 text-xs text-on-surface-variant">{t(`series.${segment.series}`)}</Text>
                    <Text weight="medium" className="text-xs" style={tabular}>
                      {segment.amount}
                    </Text>
                  </TwView>
                ))}
              <TwView className="flex-row items-center gap-2">
                <Text className="flex-1 text-xs text-on-surface-variant">{t('total')}</Text>
                <Text weight="bold" className="text-xs" style={tabular}>
                  {chosen.total}
                </Text>
              </TwView>
            </TwView>
          ) : null}
        </>
      )}
    </ChartCard>
  );
}

/** Monthly fixed spending split by type or account, as one-color bars with name and amount. */
export function SpendingBars({ title, bars }: { title: string; bars: Bar[] }) {
  const t = useTranslations('calendar.summary');
  const color = useColor();
  return (
    <ChartCard title={title} note={t('perMonthHint')}>
      {bars.length === 0 ? (
        <Text className="text-sm text-on-surface-variant">{t('empty')}</Text>
      ) : (
        bars.map((bar) => (
          <TwView key={bar.key} className="gap-1" accessible accessibilityLabel={`${bar.label}, ${bar.amount}`}>
            <TwView className="flex-row items-baseline justify-between gap-2">
              <TwView className="min-w-0 flex-1 flex-row items-baseline gap-2">
                <Text numberOfLines={1} className="shrink text-xs">
                  {bar.label}
                </Text>
                <Text className="text-xs text-on-surface-variant">{t('count', { count: bar.count })}</Text>
              </TwView>
              <Text weight="medium" className="text-xs" style={tabular}>
                {bar.amount}
              </Text>
            </TwView>
            <TwView className="h-2 rounded-full bg-track">
              <TwView className="h-2 rounded-full" style={{ width: `${Math.max(2, bar.percent)}%`, backgroundColor: color('var(--chart-1)') }} />
            </TwView>
          </TwView>
        ))
      )}
    </ChartCard>
  );
}

const PART_STYLE: Record<ProgressPart, { color: `--${string}`; icon: LucideIcon }> = {
  paid: { color: '--income', icon: CircleCheck },
  pending: { color: '--on-surface-variant', icon: Clock },
  overdue: { color: '--expense', icon: CircleAlert },
};

/** This month: paid, still to pay and overdue, as one split bar. */
export function MonthProgress({ progress, monthLabel }: { progress: CalendarSummary['progress']; monthLabel: string }) {
  const t = useTranslations('calendar.summary');
  const color = useColor();
  return (
    <ChartCard title={t('progressTitle', { month: monthLabel })}>
      {progress.value === 0 ? (
        <Text className="text-sm text-on-surface-variant">{t('progressEmpty')}</Text>
      ) : (
        <>
          <Text weight="bold" className="text-base" style={tabular}>
            {progress.total}
          </Text>
          <TwView
            accessible
            accessibilityLabel={progress.parts.map((p) => `${t(`parts.${p.part}`)}: ${p.amount}`).join(', ')}
            className="h-3 flex-row gap-[2px] overflow-hidden rounded-full bg-track"
          >
            {progress.parts
              .filter((p) => p.value > 0)
              .map((part) => (
                <TwView
                  key={part.part}
                  style={{ flexGrow: part.value, flexBasis: 0, backgroundColor: color(`var(${PART_STYLE[part.part].color})`) }}
                />
              ))}
          </TwView>
          <TwView className="gap-2">
            {progress.parts.map((part) => {
              const { icon: Glyph, color: token } = PART_STYLE[part.part];
              return (
                <TwView key={part.part} className="flex-row items-center gap-2 rounded-input bg-track px-3 py-2">
                  <Glyph size={16} color={color(`var(${token})`)} />
                  <Text className="flex-1 text-xs text-on-surface-variant">
                    {t(`parts.${part.part}`)} · {t('partCount', { count: part.count })}
                  </Text>
                  <Text weight="medium" className="text-sm" style={tabular}>
                    {part.amount}
                  </Text>
                </TwView>
              );
            })}
          </TwView>
        </>
      )}
    </ChartCard>
  );
}
