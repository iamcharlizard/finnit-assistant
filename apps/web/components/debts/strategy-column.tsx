'use client';

import { useTranslations } from 'next-intl';
import { Trophy } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { cn } from '@finnit/ui/lib/utils';

import type { StrategyPlan } from '@/lib/debts/payoff';

/** One strategy's plan: totals, then each debt in the order it is paid. */
export function StrategyColumn({
  plan,
  recommended,
}: {
  plan: StrategyPlan;
  recommended: boolean;
}) {
  const t = useTranslations('debts.plan');
  const id = `strategy-${plan.strategy}`;
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex min-w-0 flex-col gap-4 rounded-card border bg-surface p-4',
        recommended ? 'border-income/50' : 'border-outline',
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={id} className="text-base font-bold text-on-background">
            {t(`strategies.${plan.strategy}.name`)}
          </h3>
          {recommended ? (
            <Badge variant="income">
              <Trophy aria-hidden /> {t('recommended')}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-on-surface-variant">
          {t(`strategies.${plan.strategy}.description`)}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-on-surface-variant">{t('debtFree')}</dt>
          <dd className="text-lg font-bold text-on-background">
            {plan.debtFreeLabel ?? t('never')}
          </dd>
          <dd className="text-xs text-on-surface-variant">
            {plan.monthsLabel}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-on-surface-variant">{t('interest')}</dt>
          <dd className="text-lg font-bold text-on-background tabular-nums">
            {plan.interest}
          </dd>
        </div>
      </dl>

      <ol className="flex flex-col gap-3" aria-label={t('order')}>
        {plan.steps.map((step) => (
          <li key={step.debtId} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-on-background">
                <span className="mr-1.5 font-bold tabular-nums">
                  {step.position}.
                </span>
                {step.name}
              </span>
              <span
                className={cn(
                  'shrink-0 text-xs tabular-nums',
                  step.months === null
                    ? 'font-medium text-expense'
                    : 'text-on-surface-variant',
                )}
              >
                {step.payoffLabel ?? step.monthsLabel}
              </span>
            </div>
            <span
              aria-hidden
              className="block h-2 w-full overflow-hidden rounded-full bg-track"
            >
              <span
                className={cn(
                  'block h-full rounded-full',
                  step.months === null ? 'bg-expense/60' : 'bg-income',
                )}
                style={{ width: `${step.barPercent}%` }}
              />
            </span>
            <span className="text-xs text-on-surface-variant">
              {t('stepDetail', {
                months: step.monthsLabel,
                interest: step.interest,
              })}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
