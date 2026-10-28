'use client';

import { useTranslations } from 'next-intl';

import type { CapItem } from '@/lib/budgets/view';
import { CategoryTile } from './category-tile';
import { StatusText } from './status-text';
import { UsageBar } from './usage-bar';

/** One category cap: spent of the cap, a bar and what is left. */
export function CapListItem({ item }: { item: CapItem }) {
  const t = useTranslations('budgets.caps');
  return (
    <li className="flex items-start gap-3 rounded-card border border-outline bg-surface p-4">
      <CategoryTile iconKey={item.iconKey} color={item.color} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <div className="flex min-w-0 flex-col">
            <h3 className="truncate text-sm font-bold text-on-background">
              {item.name}
            </h3>
            {item.parentName ? (
              <span className="text-xs text-on-surface-variant">
                {item.parentName}
              </span>
            ) : null}
          </div>
          <span className="text-sm text-on-background tabular-nums">
            {t('spentOf', { spent: item.spent, cap: item.budgeted })}
          </span>
        </div>
        <UsageBar
          percent={item.percent}
          status={item.status}
          label={t('barLabel', { category: item.name, percent: item.percent })}
        />
        <div className="flex justify-between gap-2">
          <StatusText status={item.status}>
            {item.over
              ? t('over', { amount: item.remaining })
              : item.status === 'over'
                ? t('reached')
                : t('left', { amount: item.remaining })}
          </StatusText>
          <span className="text-xs text-on-surface-variant tabular-nums">
            {item.percent}%
          </span>
        </div>
      </div>
    </li>
  );
}
