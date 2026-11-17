'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { StackedBarsChart } from '@/components/charts/stacked-bars-chart';
import {
  CARD_PERIODS_QUERY,
  periodSpendingBars,
  type CardPeriodsResult,
} from '@finnit/core/accounts/card-period';
import type { StackedBar } from '@finnit/core/finance/stacked-bars';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

/** Cycles in the chart: about half a year. */
const PERIODS = 6;

/**
 * What the card billed each cycle: one-off spending and installments of
 * purchases in installments, stacked. Nothing shows if the card has no
 * cycles (no cut-off and payment days) or they can't be read.
 */
export function CardPeriodSpending({ accountId }: { accountId: string }) {
  const t = useTranslations('accounts.cardSummary');
  const l = useLocalizer();
  const [bars, setBars] = React.useState<StackedBar[] | null>(null);

  React.useEffect(() => {
    let live = true;
    gql<CardPeriodsResult>(CARD_PERIODS_QUERY, {
      accountId,
      first: PERIODS,
      after: null,
    })
      .then(({ creditCardPeriods }) => {
        if (!live) return;
        const periods = creditCardPeriods.edges.map((e) => e.node);
        setBars(periods.length > 0 ? periodSpendingBars(periods, l) : null);
      })
      .catch(() => live && setBars(null));
    return () => {
      live = false;
    };
  }, [accountId, l]);

  if (!bars) return null;
  return (
    <StackedBarsChart
      title={t('spendingTitle')}
      hint={t('spendingHint')}
      bars={bars}
      series={[
        { key: 'oneOff', label: t('oneOff'), color: 'var(--chart-1)' },
        {
          key: 'installments',
          label: t('installments'),
          color: 'var(--chart-2)',
        },
      ]}
      labels={{
        bar: (bar) => t('bar', { label: bar.label, total: bar.total }),
        column: t('period'),
        total: t('total'),
        seeTable: t('seeTable'),
        empty: t('empty'),
      }}
    />
  );
}
