'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ListChecks, RefreshCw, Sparkles } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import { Card } from '@finnit/ui/components/ui/card';
import { toast } from '@finnit/ui/components/ui/toaster';

import { DonutChart } from '@/components/charts/donut-chart';
import { EmptyState } from '@/components/finance/empty-state';
import {
  LEVEL_COLOR,
  type RecurringAnalytics as Analytics,
} from '@finnit/core/recurring/analytics';
import {
  classifyEssentials,
  type EssentialAnswers,
} from '@finnit/core/recurring/essentials';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { EssentialsQuestionnaire } from './essentials-questionnaire';

const LEVEL_BADGE = {
  essential: 'success',
  reducible: 'muted',
  dispensable: 'expense',
} as const;

/**
 * "Análisis" of Pagos recurrentes: what goes to them each month, by
 * category and by kind; and what the AI judged essential, reducible or
 * dispensable from the user's answers (a questionnaire the first time).
 */
export function RecurringAnalytics({
  analytics,
  answers,
  onChanged,
}: {
  analytics: Analytics;
  /** null: the questionnaire hasn't been answered. */
  answers: EssentialAnswers | null;
  onChanged: () => void;
}) {
  const t = useTranslations('recurring.analytics');
  const l = useLocalizer();
  const [asking, setAsking] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const { essentials } = analytics;

  async function analyze(onlyMissing: boolean) {
    setRunning(true);
    try {
      const run = await classifyEssentials(onlyMissing, gql);
      if (run.aiUnavailable) toast.error(t('aiUnavailable'));
      else toast.success(t('analyzed', { count: run.classified }));
      onChanged();
    } catch (error) {
      toast.error(requestErrorMessage(error, l.t));
    } finally {
      setRunning(false);
    }
  }

  const chartLabels = (column: string) => ({
    count: (count: number) => t('count', { count }),
    column,
    total: t('total'),
    seeTable: t('seeTable'),
    empty: t('empty'),
  });

  if (analytics.count === 0) {
    return <EmptyState icon={ListChecks} title={t('empty')} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="gap-1 rounded-[20px] p-4.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-on-surface-variant">
          {t('monthly')}
        </p>
        <p className="text-2xl font-bold text-on-background tabular-nums">
          {analytics.monthly}
        </p>
        <p className="text-xs text-on-surface-variant">
          {t('count', { count: analytics.count })}
        </p>
      </Card>

      <div className="grid gap-4 @3xl:grid-cols-2">
        <DonutChart
          title={t('byCategory')}
          slices={analytics.byCategory}
          centerValue={analytics.monthly}
          centerLabel={t('monthly')}
          labels={chartLabels(t('category'))}
        />
        <DonutChart
          title={t('byKind')}
          slices={analytics.byKind}
          centerValue={analytics.monthly}
          centerLabel={t('monthly')}
          labels={chartLabels(t('kind'))}
        />
      </div>

      <section
        aria-labelledby="recurring-essentials"
        className="flex flex-col gap-4 rounded-[20px] bg-surface p-4.5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2
              id="recurring-essentials"
              className="flex items-center gap-2 text-base font-bold text-on-background"
            >
              <Sparkles aria-hidden className="size-4 text-brand-ink" />
              {t('essentialsTitle')}
            </h2>
            {answers ? null : (
              <p className="text-sm text-on-surface-variant">
                {t('essentialsIntro')}
              </p>
            )}
          </div>
          {answers ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={running}
                onClick={() => void analyze(false)}
              >
                <RefreshCw aria-hidden />{' '}
                {running ? t('analyzing') : t('analyzeAgain')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={running}
                onClick={() => setAsking(true)}
              >
                {t('redo')}
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setAsking(true)}>
              {t('start')}
            </Button>
          )}
        </div>

        {answers ? (
          <>
            {essentials.items.length > 0 ? (
              <>
                <div
                  aria-hidden
                  className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-track"
                >
                  {essentials.levels
                    .filter((level) => level.value > 0)
                    .map((level) => (
                      <span
                        key={level.level}
                        style={{
                          flexGrow: level.value,
                          background: LEVEL_COLOR[level.level],
                        }}
                      />
                    ))}
                </div>
                <dl className="grid gap-3 sm:grid-cols-3">
                  {essentials.levels.map((level) => (
                    <div key={level.level} className="flex flex-col gap-0.5">
                      <dt className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                        <span
                          aria-hidden
                          className="size-2 rounded-full"
                          style={{ background: LEVEL_COLOR[level.level] }}
                        />
                        {level.label}
                      </dt>
                      <dd className="text-lg font-bold text-on-background tabular-nums">
                        {level.amount}
                      </dd>
                      <dd className="text-xs text-on-surface-variant">
                        {t('count', { count: level.count })} · {level.percent}%
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-sm font-medium text-on-background">
                  {essentials.savingsValue > 0
                    ? t('savings', { amount: essentials.savings })
                    : t('noSavings')}
                </p>
              </>
            ) : null}
            {essentials.pending > 0 ? (
              <div className="flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
                {t('pending', { count: essentials.pending })}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={running}
                  onClick={() => void analyze(true)}
                >
                  {running ? t('analyzing') : t('analyzePending')}
                </Button>
              </div>
            ) : null}
            {essentials.items.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-bold text-on-background">
                  {t('listTitle')}
                </h3>
                <ul className="flex flex-col divide-y divide-outline">
                  {essentials.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm text-on-background">
                          {item.name}
                        </span>
                        {item.reason ? (
                          <span className="text-xs text-on-surface-variant">
                            {item.reason}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-medium text-on-background tabular-nums">
                          {item.amount}
                        </span>
                        <Badge variant={LEVEL_BADGE[item.level]}>
                          {item.levelLabel}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
        {analytics.debts.count > 0 ? (
          <p className="text-xs text-on-surface-variant">
            {t('debts', {
              amount: analytics.debts.amount,
              count: analytics.debts.count,
            })}
          </p>
        ) : null}
      </section>

      {asking ? (
        <EssentialsQuestionnaire
          initial={answers}
          onClose={() => setAsking(false)}
          onDone={() => {
            setAsking(false);
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}
