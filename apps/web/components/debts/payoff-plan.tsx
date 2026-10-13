'use client';

import { useTranslations } from 'next-intl';
import { Lightbulb } from 'lucide-react';

import { Input } from '@finnit/ui/components/ui/input';
import { cn } from '@finnit/ui/lib/utils';

import { usePayoffComparison } from '@/hooks/use-payoff-comparison';
import type { PayoffComparison } from '@/lib/debts/payoff';
import type { DayKey } from '@/lib/finance/dates';
import { StrategyColumn } from './strategy-column';

/**
 * "Plan para salir de deudas": an extra monthly payment and the two
 * strategies side by side, with the same debts and the same money.
 */
export function PayoffPlan({
  debtIds,
  stamp,
  initial,
  today,
}: {
  debtIds: string[];
  stamp: string;
  initial: PayoffComparison | null;
  today: DayKey;
}) {
  const t = useTranslations('debts.plan');
  const { extraText, setExtraText, state } = usePayoffComparison({
    debtIds,
    stamp,
    initial,
    today,
  });
  if (!state) return null;
  const plan = state.status === 'error' ? null : state.plan;

  return (
    <section aria-labelledby="payoff-plan" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 px-1">
        <h2
          id="payoff-plan"
          className="text-lg font-bold text-on-background sm:text-xl"
        >
          {t('title')}
        </h2>
        <p className="text-sm text-on-surface-variant">{t('subtitle')}</p>
      </div>

      <div className="flex max-w-sm flex-col gap-1">
        <Input
          label={t('extra')}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={extraText}
          onChange={(e) => setExtraText(e.target.value)}
          error={state.status === 'invalid' ? t('extraInvalid') : undefined}
        />
        <p className="px-1 text-xs text-on-surface-variant">{t('extraHint')}</p>
      </div>

      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-expense">
          {t('error')}
        </p>
      ) : null}

      {plan ? (
        <div
          aria-busy={state.status === 'loading'}
          className={cn(
            'flex flex-col gap-4 transition-opacity',
            state.status === 'loading' && 'opacity-60',
          )}
        >
          <p
            aria-live="polite"
            className="flex items-start gap-2 rounded-input bg-accent-neon/10 p-3 text-sm text-on-background"
          >
            <Lightbulb
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-violet-ink"
            />
            {plan.verdict}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <StrategyColumn
              plan={plan.avalanche}
              recommended={plan.better === 'avalanche'}
            />
            <StrategyColumn
              plan={plan.snowball}
              recommended={plan.better === 'snowball'}
            />
          </div>
          <p className="px-1 text-xs text-on-surface-variant">
            {t('assumptions')}
          </p>
        </div>
      ) : null}
    </section>
  );
}
