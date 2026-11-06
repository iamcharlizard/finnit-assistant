import { useTranslations } from 'use-intl';

import type { TypeBar } from '@finnit/core/debts/insights-view';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { useColor } from '@finnit/ui-native/theme/theme-root';
import { Text } from '@finnit/ui-native/components/ui/text';

/** What is owed now by kind of debt, as horizontal bars with name and amount. */
export function DebtTypeBars({ bars, className }: { bars: TypeBar[]; className?: string }) {
  const t = useTranslations('debts.insights');
  const color = useColor();
  return (
    <TwView className={cn('gap-3 rounded-card border border-outline bg-surface p-4', className)}>
      <Text accessibilityRole="header" weight="bold" className="text-sm">
        {t('byTypeTitle')}
      </Text>
      {bars.length === 0 ? (
        <Text className="text-sm text-on-surface-variant">{t('nothingOwed')}</Text>
      ) : (
        bars.map((bar) => (
          <TwView key={bar.type} className="gap-1" accessible accessibilityLabel={`${bar.label}, ${bar.amount}`}>
            <TwView className="flex-row items-baseline justify-between gap-2">
              <TwView className="min-w-0 flex-1 flex-row items-center gap-2">
                <TwView className="size-2.5 rounded-full" style={{ backgroundColor: color(bar.color) }} />
                <Text numberOfLines={1} className="shrink text-xs">
                  {bar.label}
                </Text>
                <Text className="text-xs text-on-surface-variant">{t('count', { count: bar.count })}</Text>
              </TwView>
              <Text weight="medium" className="text-xs" style={{ fontVariant: ['tabular-nums'] }}>
                {bar.amount}
              </Text>
            </TwView>
            <TwView className="h-2 rounded-full bg-track">
              <TwView
                className="h-2 rounded-full"
                style={{ width: `${Math.max(2, bar.percent)}%`, backgroundColor: color(bar.color) }}
              />
            </TwView>
          </TwView>
        ))
      )}
    </TwView>
  );
}
