import * as React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslations } from 'use-intl';
import { List, PieChart, type LucideIcon } from 'lucide-react-native';

import type { HistoryData } from '@finnit/core/history/request';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { CategoryDonut } from '@finnit/ui-native/components/finance/category-donut';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';
import { useColor } from '@finnit/ui-native/theme/theme-root';

type View = 'list' | 'chart';

const STORAGE_KEY = 'finnit-history-top-view';

/** The month's top categories as a list or a donut (the web's TopCategoriesCard); the choice is remembered on the device. */
export function TopCategoriesCard({ data }: { data: HistoryData['topCategories'] }) {
  const t = useTranslations('history');
  const color = useColor();
  const [view, setView] = React.useState<View>('list');

  React.useEffect(() => {
    let live = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => live && saved === 'chart' && setView('chart'))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  function choose(next: View) {
    setView(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }

  const summary = t('chartSummary', { items: data.chart.slices.map((s) => `${s.label} ${s.percentage}`).join(', ') });

  return (
    <TwView className="rounded-card border border-glass-border bg-glass p-6">
      <TwView className="mb-4 flex-row items-start justify-between gap-3">
        <Text accessibilityRole="header" weight="medium" className="flex-1 text-base">
          {data.title}
        </Text>
        <TwView accessibilityLabel={t('topView.label')} className="-mr-2 -mt-1 flex-row gap-0.5 rounded-full bg-track p-0.5">
          <ViewButton icon={List} label={t('topView.list')} pressed={view === 'list'} onPress={() => choose('list')} />
          <ViewButton icon={PieChart} label={t('topView.chart')} pressed={view === 'chart'} onPress={() => choose('chart')} />
        </TwView>
      </TwView>
      {view === 'chart' ? (
        <CategoryDonut
          slices={data.chart.slices.map((s) => ({ id: s.id, label: s.label, percent: s.percent, amount: s.amount, percentage: s.percentage, color: s.dotColor }))}
          totalLabel={t('chartTotal')}
          total={data.chart.total}
          summary={summary}
        />
      ) : (
        <TwView className="gap-4">
          {data.rows.map((row) => (
            <TwView key={row.id} className="flex-row items-center justify-between">
              <TwView className="flex-row items-center gap-3">
                <TwView className="size-2 rounded-full" style={{ backgroundColor: color(row.dotColor) }} />
                <Text className="text-sm">{row.label}</Text>
              </TwView>
              <Text weight="medium" className="text-xs tracking-wide text-on-surface-variant">
                {row.percentage}
              </Text>
            </TwView>
          ))}
        </TwView>
      )}
    </TwView>
  );
}

function ViewButton({ icon, label, pressed, onPress }: { icon: LucideIcon; label: string; pressed: boolean; onPress: () => void }) {
  return (
    <TwPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: pressed }}
      onPress={onPress}
      className={cn('size-10 items-center justify-center rounded-full', pressed && 'bg-surface')}
    >
      <Icon icon={icon} size={16} color={pressed ? '--on-background' : '--on-surface-variant'} />
    </TwPressable>
  );
}
