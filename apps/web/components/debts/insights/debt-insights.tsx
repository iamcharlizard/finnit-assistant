'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Progress } from '@finnit/ui/components/ui/progress';

import { SwitchField } from '@/components/finance/switch-field';
import { buildDebtInsightsView } from '@/lib/debts/insights-view';
import type { ApiDebtInsights } from '@/lib/debts/types';
import type { DayKey } from '@/lib/finance/dates';
import { useLocalizer } from '@/lib/i18n/client';
import { BalanceProjectionChart } from './balance-projection-chart';
import { DebtLoadCard } from './debt-load-card';
import { DebtTypeBars } from './debt-type-bars';
import { MsiPlans } from './msi-plans';
import { PaidByMonthChart } from './paid-by-month-chart';

const MSI_KEY = 'finnit.debts.includeMsi';

/**
 * The debts charts: debt now vs everything owed, by type, paid per month,
 * the projected balance, what is due soon and the debt load. Card MSI plans
 * are left out unless the toggle (remembered per browser) includes them.
 */
export function DebtInsights({
  data,
  today,
  title,
}: {
  data: ApiDebtInsights;
  today: DayKey;
  /** Section heading; "Tu deuda en números" by default. */
  title?: string;
}) {
  const l = useLocalizer();
  const t = useTranslations('debts.insights');
  const [includeMsi, setIncludeMsi] = React.useState(false);

  React.useEffect(() => {
    try {
      setIncludeMsi(window.localStorage.getItem(MSI_KEY) === '1');
    } catch {
      // Storage unavailable: keep the default.
    }
  }, []);

  function toggle(checked: boolean) {
    setIncludeMsi(checked);
    try {
      window.localStorage.setItem(MSI_KEY, checked ? '1' : '0');
    } catch {
      // Not remembered; the toggle still works.
    }
  }

  const view = React.useMemo(
    () => buildDebtInsightsView(data, { today, includeMsi }, l),
    [data, today, includeMsi, l],
  );

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="debt-insights" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <h2
            id="debt-insights"
            className="text-lg font-bold text-on-background sm:text-xl"
          >
            {title ?? t('title')}
          </h2>
          {view.hasMsi ? (
            <div className="w-full sm:w-auto sm:min-w-72">
              <SwitchField
                label={t('includeMsi')}
                hint={t('includeMsiHint')}
                checked={includeMsi}
                onCheckedChange={toggle}
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 rounded-card border border-outline bg-surface p-4">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-on-surface-variant">
                {t('current')}
              </dt>
              <dd className="text-3xl font-bold text-on-background tabular-nums">
                {view.current}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-on-surface-variant">{t('total')}</dt>
              <dd className="text-3xl font-bold text-on-background tabular-nums">
                {view.total}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-on-surface-variant">
                {t('paidSoFar')}
              </dt>
              <dd className="text-3xl font-bold text-on-background tabular-nums">
                {view.paid}
              </dd>
            </div>
          </dl>
          <Progress
            value={view.paidPercent}
            indicatorColor="var(--chart-1)"
            aria-label={t('currentVsTotal', { percent: view.paidPercent })}
            className="h-2"
          />
          <p className="text-xs text-on-surface-variant">
            {t('currentVsTotal', { percent: view.paidPercent })}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <DebtTypeBars bars={view.types} />
          <DebtLoadCard view={view} />
          <PaidByMonthChart
            months={view.months}
            series={view.paidSeries}
            hasPayments={view.hasPayments}
          />
          <BalanceProjectionChart
            points={view.projection}
            paidOffLabel={view.paidOffLabel}
          />
        </div>
      </section>

      <MsiPlans rows={view.msi} />
    </div>
  );
}
