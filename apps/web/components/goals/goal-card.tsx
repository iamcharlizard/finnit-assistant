import { useTranslations } from 'next-intl';
import { CalendarDays, ChevronRight, ChartLine } from 'lucide-react';

import { cn } from '@finnit/ui/lib/utils';

import type { GoalCardView } from '@/lib/goals/view';
import { GoalStatusBadge } from './goal-status-badge';
import { ProgressRing } from './progress-ring';

/** One goal in the grid: progress, deadline, projection and status. Opens the detail. */
export function GoalCard({
  card,
  selected,
  onOpen,
}: {
  card: GoalCardView;
  selected: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations('goals.card');
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('open', { name: card.name })}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'group flex min-w-0 flex-col gap-4 rounded-card border border-glass-border bg-glass p-4 text-left backdrop-blur-md transition-colors outline-none hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50',
        selected && 'border-ring',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="truncate text-base font-bold text-on-background">
            {card.name}
          </h2>
          <GoalStatusBadge status={card.status} />
        </div>
        <ChevronRight
          aria-hidden
          className="mt-1 size-4 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5"
        />
      </div>

      <div className="flex items-center gap-4">
        <ProgressRing
          percent={card.percent}
          reached={card.status === 'reached'}
          label={t('progressLabel', { percent: card.percent })}
        />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xl font-bold text-on-background tabular-nums">
            {card.saved}
          </span>
          <span className="truncate text-xs text-on-surface-variant">
            {t('of', { target: card.target })}
          </span>
          {card.status !== 'reached' ? (
            <span className="truncate text-xs text-on-surface-variant">
              {t('remaining', { amount: card.remaining })}
            </span>
          ) : null}
        </div>
      </div>

      <dl className="flex flex-col gap-1.5 border-t border-outline/60 pt-3 text-xs">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <dt className="sr-only">{t('dueTerm')}</dt>
          <CalendarDays aria-hidden className="size-3.5 shrink-0" />
          <dd className="min-w-0 truncate">
            {card.dueLabel}
            {card.daysLabel ? (
              <span className="font-medium text-on-background">
                {' · '}
                {card.daysLabel}
              </span>
            ) : null}
          </dd>
        </div>
        <div className="flex items-center gap-2 text-on-surface-variant">
          <dt className="sr-only">{t('projectionTerm')}</dt>
          <ChartLine aria-hidden className="size-3.5 shrink-0" />
          <dd className="min-w-0 truncate">{card.projectionLabel}</dd>
        </div>
      </dl>
    </button>
  );
}
