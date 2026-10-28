'use client';

import { useTranslations } from 'next-intl';
import { CalendarDays, Pencil, Trash2 } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@finnit/ui/components/ui/sheet';

import type { ContributionItem, GoalDetailView } from '@/lib/goals/view';
import { ContributionForm } from './contribution-form';
import { ContributionList } from './contribution-list';
import { GoalProjectionCard } from './goal-projection-card';
import { GoalRecommendations } from './goal-recommendations';
import { GoalStatusBadge } from './goal-status-badge';
import { ProgressRing } from './progress-ring';

/**
 * A goal's detail (`?goal=<id>`): progress, projection with an editable
 * monthly amount, tips, and its contributions. `detail` is null while the
 * page loads it.
 */
export function GoalDetailSheet({
  open,
  detail,
  today,
  busyId,
  onClose,
  onEdit,
  onDelete,
  onContributionAdded,
  onRemoveContribution,
}: {
  open: boolean;
  detail: GoalDetailView | null;
  today: string;
  busyId: string | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onContributionAdded: (amountText: string) => void;
  onRemoveContribution: (item: ContributionItem) => void;
}) {
  const t = useTranslations('goals.detail');
  const tc = useTranslations();
  const card = detail?.card;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        closeLabel={tc('common.close')}
        className="w-full max-w-lg gap-5 overflow-y-auto px-4 pt-5 pb-8 sm:px-6"
      >
        {card && detail ? (
          <>
            <div className="flex flex-col gap-2 pr-12">
              <SheetTitle className="break-words">{card.name}</SheetTitle>
              <SheetDescription className="flex items-center gap-1.5">
                <CalendarDays aria-hidden className="size-3.5" />
                {card.dueLabel}
                {card.daysLabel ? ` · ${card.daysLabel}` : ''}
              </SheetDescription>
              <GoalStatusBadge status={card.status} />
            </div>

            <section className="flex items-center gap-5 rounded-card border border-glass-border bg-glass p-4">
              <ProgressRing
                percent={card.percent}
                reached={card.status === 'reached'}
                size={96}
                label={tc('goals.card.progressLabel', {
                  percent: card.percent,
                })}
              />
              <dl className="grid min-w-0 flex-1 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-on-surface-variant">
                    {t('saved')}
                  </dt>
                  <dd className="truncate text-xl font-bold text-on-background tabular-nums">
                    {card.saved}
                  </dd>
                </div>
                <div className="flex gap-4">
                  <div className="min-w-0">
                    <dt className="text-xs text-on-surface-variant">
                      {t('target')}
                    </dt>
                    <dd className="truncate font-medium text-on-background tabular-nums">
                      {card.target}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-on-surface-variant">
                      {t('remaining')}
                    </dt>
                    <dd className="truncate font-medium text-on-background tabular-nums">
                      {card.remaining}
                    </dd>
                  </div>
                </div>
              </dl>
            </section>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onEdit}
              >
                <Pencil aria-hidden /> {t('edit')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onDelete}
              >
                <Trash2 aria-hidden /> {t('delete')}
              </Button>
            </div>

            <GoalProjectionCard
              key={`${card.id}:${card.goal.currentAmount}:${card.goal.targetAmount}:${card.goal.dueDate}`}
              goal={card.goal}
              initial={detail.apiProjection}
              detail={detail}
              today={today}
            />

            <GoalRecommendations detail={detail} />

            <section
              aria-labelledby="goal-contributions-title"
              className="flex flex-col gap-3"
            >
              <h3
                id="goal-contributions-title"
                className="text-sm font-bold text-on-background"
              >
                {t('contributions', { count: detail.contributions.length })}
              </h3>
              {detail.canContribute ? (
                <ContributionForm
                  goalId={card.id}
                  onAdded={onContributionAdded}
                />
              ) : (
                <p className="rounded-input bg-accent-neon/10 p-3 text-sm text-on-background">
                  {t('reachedNote')}
                </p>
              )}
              <ContributionList
                items={detail.contributions}
                busyId={busyId}
                onRemove={onRemoveContribution}
              />
            </section>
          </>
        ) : (
          <div
            role="status"
            aria-label={tc('common.loading')}
            className="flex flex-col gap-4"
          >
            <SheetTitle className="sr-only">{tc('common.loading')}</SheetTitle>
            <div className="h-8 w-2/3 animate-pulse rounded-input bg-track" />
            <div className="h-32 animate-pulse rounded-card bg-track" />
            <div className="h-40 animate-pulse rounded-card bg-track" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
