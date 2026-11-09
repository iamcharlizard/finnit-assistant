'use client';

import { useTranslations } from 'next-intl';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { StatTile } from '@finnit/ui/components/finance/stat-tile';
import { InfoHint } from '@finnit/ui/components/ui/info-hint';

import type { DashboardStat } from '@finnit/core/dashboard/view';

/** Each tile's icon and color, in the charts' fixed order. */
const LOOK: Record<DashboardStat['key'], { icon: LucideIcon; color: string }> =
  {
    balance: { icon: Wallet, color: 'var(--chart-1)' },
    expenses: { icon: ArrowUpRight, color: 'var(--chart-2)' },
    income: { icon: ArrowDownLeft, color: 'var(--chart-3)' },
    pending: { icon: CalendarClock, color: 'var(--chart-4)' },
  };

/**
 * The home's analytics: total balance, this month's spending and income
 * (against the same days of last month) and what is due soon.
 */
export function DashboardStats({ stats }: { stats: DashboardStat[] }) {
  const t = useTranslations('dashboard.stats');
  return (
    <section aria-label={t('title')} className="min-w-0">
      <div className="grid gap-3 @sm:grid-cols-2 @7xl:grid-cols-4">
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
            hint={
              <InfoHint label={stat.label}>
                <p className="max-w-64 text-sm">{stat.hint}</p>
              </InfoHint>
            }
          />
        ))}
      </div>
    </section>
  );
}
