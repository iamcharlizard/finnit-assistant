'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { List, PieChart, type LucideIcon } from 'lucide-react';

import { CategoryDonut } from '@finnit/ui/components/finance/category-donut';
import { cn } from '@finnit/ui/lib/utils';

import type { HistoryData } from '@finnit/core/history/request';

type View = 'list' | 'chart';

const STORAGE_KEY = 'finnit-history-top-view';

function readView(): View {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'chart'
      ? 'chart'
      : 'list';
  } catch {
    return 'list';
  }
}

/**
 * The month's top spending categories, as a list or as a donut (the rest
 * together as "Otras categorías"). The choice is remembered in this
 * browser.
 */
export function TopCategoriesCard({
  data,
}: {
  data: HistoryData['topCategories'];
}) {
  const t = useTranslations('history');
  const [view, setView] = React.useState<View>('list');
  React.useEffect(() => setView(readView()), []);

  function choose(next: View) {
    setView(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode: it just isn't remembered.
    }
  }

  const summary = t('chartSummary', {
    items: data.chart.slices
      .map((s) => `${s.label} ${s.percentage}`)
      .join(', '),
  });

  return (
    <section className="rounded-card border border-glass-border bg-glass p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-base font-medium text-on-background">
          {data.title}
        </h3>
        <div
          role="group"
          aria-label={t('topView.label')}
          className="-mt-1 -mr-2 flex shrink-0 gap-0.5 rounded-full bg-track p-0.5"
        >
          <ViewButton
            icon={List}
            label={t('topView.list')}
            pressed={view === 'list'}
            onClick={() => choose('list')}
          />
          <ViewButton
            icon={PieChart}
            label={t('topView.chart')}
            pressed={view === 'chart'}
            onClick={() => choose('chart')}
          />
        </div>
      </div>

      {view === 'chart' ? (
        <CategoryDonut
          slices={data.chart.slices.map((s) => ({
            id: s.id,
            label: s.label,
            percent: s.percent,
            amount: s.amount,
            percentage: s.percentage,
            color: s.dotColor,
          }))}
          totalLabel={t('chartTotal')}
          total={data.chart.total}
          summary={summary}
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {data.rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between">
              <span className="flex items-center gap-3 text-sm text-on-background">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: row.dotColor }}
                />
                {row.label}
              </span>
              <span className="text-xs font-medium tracking-wide text-on-surface-variant">
                {row.percentage}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ViewButton({
  icon: Icon,
  label,
  pressed,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'flex size-9 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
        pressed
          ? 'bg-surface text-on-background shadow-sm'
          : 'text-on-surface-variant hover:text-on-background',
      )}
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );
}
