'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChartLine } from 'lucide-react';

import { Input } from '@finnit/ui/components/ui/input';
import { cn } from '@finnit/ui/lib/utils';

import { useGoalProjection } from '@/hooks/use-goal-projection';
import { goalErrorMessage } from '@/lib/goals/api';
import { parseMonthlyContribution } from '@/lib/goals/form';
import type { ApiGoal, ApiGoalProjection } from '@/lib/goals/types';
import { buildProjectionView, type GoalDetailView } from '@/lib/goals/view';
import { useLocalizer } from '@/lib/i18n/client';
import { GoalStatusBadge } from './goal-status-badge';

/**
 * "¿Cuándo llego?": the projection for an editable monthly amount, starting
 * from the average of the last 3 months of contributions.
 */
export function GoalProjectionCard({
  goal,
  initial,
  detail,
  today,
}: {
  goal: ApiGoal;
  initial: ApiGoalProjection;
  detail: GoalDetailView;
  today: string;
}) {
  const l = useLocalizer();
  const t = useTranslations('goals.projection');
  const [text, setText] = React.useState(detail.monthlyText);
  const monthly = parseMonthlyContribution(text);
  const state = useGoalProjection(goal.id, initial, monthly);
  const view = buildProjectionView(goal, state.projection, today, l);
  const invalid = text.trim() !== '' && monthly === null;

  return (
    <section
      aria-labelledby="goal-projection-title"
      className="flex flex-col gap-3 rounded-card border border-glass-border bg-glass p-4"
    >
      <div className="flex items-center gap-2">
        <ChartLine aria-hidden className="size-4 text-tertiary" />
        <h3
          id="goal-projection-title"
          className="text-sm font-bold text-on-background"
        >
          {t('title')}
        </h3>
      </div>

      {view.status !== 'reached' ? (
        <div className="flex flex-col gap-1">
          <Input
            label={t('monthly')}
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            error={invalid ? t('monthlyInvalid') : undefined}
          />
          <p className="flex flex-wrap items-center gap-x-2 px-1 text-xs text-on-surface-variant">
            {t('monthlyHint', { amount: detail.averageMonthly })}
            {text !== detail.monthlyText ? (
              <button
                type="button"
                onClick={() => setText(detail.monthlyText)}
                className="font-medium text-income hover:underline"
              >
                {t('useAverage')}
              </button>
            ) : null}
            {detail.needed && text !== detail.needed.text ? (
              <button
                type="button"
                onClick={() => setText(detail.needed!.text)}
                className="font-medium text-income hover:underline"
              >
                {t('useNeeded')}
              </button>
            ) : null}
          </p>
        </div>
      ) : null}

      <div
        aria-live="polite"
        aria-busy={state.status === 'loading'}
        className={cn(
          'flex flex-col gap-1.5 transition-opacity',
          state.status === 'loading' && 'opacity-60',
        )}
      >
        <p className="text-base font-bold text-on-background">
          {view.headline}
        </p>
        {view.detail ? (
          <p className="text-sm text-on-surface-variant">{view.detail}</p>
        ) : null}
        <GoalStatusBadge status={view.status} />
        {state.status === 'error' ? (
          <p role="alert" className="text-xs text-expense">
            {goalErrorMessage(state.error, l.t)}
          </p>
        ) : null}
      </div>
    </section>
  );
}
