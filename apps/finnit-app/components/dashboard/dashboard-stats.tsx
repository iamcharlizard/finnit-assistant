import { ScrollView, useWindowDimensions } from 'react-native';
import { useTranslations } from 'use-intl';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';

import type { DashboardStat } from '@finnit/core/dashboard/view';
import { StatTile } from '@finnit/ui-native/components/finance/stat-tile';

/** Each tile's icon and color, in the charts' fixed order (as on the web). */
const LOOK: Record<DashboardStat['key'], { icon: LucideIcon; color: string }> =
  {
    balance: { icon: Wallet, color: 'var(--chart-1)' },
    expenses: { icon: ArrowUpRight, color: 'var(--chart-2)' },
    income: { icon: ArrowDownLeft, color: 'var(--chart-3)' },
    pending: { icon: CalendarClock, color: 'var(--chart-4)' },
  };

/** Screen padding on each side (Screen's px-4). */
const SIDE = 16;
const GAP = 12;

/**
 * The analytics in one row that scrolls sideways, each tile half the
 * screen wide (two in view, the rest a swipe away), snapping per tile.
 */
export function DashboardStats({ stats }: { stats: DashboardStat[] }) {
  const t = useTranslations('dashboard.stats');
  const { width } = useWindowDimensions();
  const tile = Math.round((width - SIDE * 2 - GAP) / 2);
  return (
    <ScrollView
      horizontal
      accessibilityLabel={t('title')}
      showsHorizontalScrollIndicator={false}
      snapToInterval={tile + GAP}
      decelerationRate="fast"
      // Full-bleed: tiles scroll under the screen's padding.
      style={{ marginHorizontal: -SIDE }}
      contentContainerStyle={{ paddingHorizontal: SIDE, gap: GAP }}
    >
      {stats.map((stat) => (
        <StatTile
          key={stat.key}
          icon={LOOK[stat.key].icon}
          color={LOOK[stat.key].color}
          label={stat.label}
          value={stat.value}
          trend={stat.trend}
          compareLabel={stat.compareLabel}
          caption={stat.caption}
          spark={stat.spark}
          trendLabel={
            stat.trend && stat.trend.direction !== 'flat'
              ? t(stat.trend.direction === 'up' ? 'trendUp' : 'trendDown', {
                  percent: stat.trend.label.replace(/^[+-]/, ''),
                  compare: stat.compareLabel ?? '',
                })
              : undefined
          }
          className="shrink-0"
          style={{ width: tile }}
        />
      ))}
    </ScrollView>
  );
}
