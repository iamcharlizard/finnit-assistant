import { CalendarClock, TrendingUp } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { NeoTipCard } from '@finnit/ui/components/finance/neo-tip-card';
import { SparklineChart } from '@finnit/ui/components/finance/sparkline-chart';

import { PreviewTransactions } from './preview-transactions';
import { LandingSectionHeading } from './section-heading';

/** A dashboard made of the app's real components with sample data. */
export async function AppPreview() {
  const t = await getTranslations('landing.preview');
  return (
    <section aria-labelledby="preview-title" className="px-6 py-14 @4xl:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 @4xl:grid-cols-[1fr_1.15fr]">
        <LandingSectionHeading
          id="preview-title"
          eyebrow={t('eyebrow')}
          title={t('title')}
          lead={t('lead')}
        />
        <div
          aria-hidden
          className="landing-reveal relative rounded-[32px] border border-glass-border bg-glass p-4 shadow-elevation glass @lg:p-6"
        >
          <div className="grid gap-4 @lg:grid-cols-2">
            <div className="rounded-card bg-surface p-5 @lg:col-span-2">
              <p className="text-xs font-medium text-on-surface-variant">
                {t('balanceLabel')}
              </p>
              <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
                <p className="text-[34px] leading-none font-bold tracking-tight text-on-background tabular-nums">
                  $24,380.
                  <span className="text-xl text-on-surface-variant">50</span>
                </p>
                <p className="flex items-center gap-1 text-xs font-bold text-income">
                  <TrendingUp className="size-3.5" />
                  {t('balanceDelta')}
                </p>
              </div>
              <div className="mt-3 h-16">
                <SparklineChart color="var(--ai)" />
              </div>
            </div>
            <div className="rounded-card bg-surface p-2 @lg:col-span-2">
              <PreviewTransactions
                items={[
                  {
                    merchant: t('tx1'),
                    category: t('tx1Category'),
                    time: t('today'),
                    amount: '−$1,240.00',
                    icon: 'groceries',
                    variant: 'expense',
                  },
                  {
                    merchant: t('tx2'),
                    category: t('tx2Category'),
                    time: t('yesterday'),
                    amount: '+$18,500.00',
                    icon: 'payroll',
                    variant: 'income',
                  },
                  {
                    merchant: t('tx3'),
                    category: t('tx3Category'),
                    time: t('yesterday'),
                    amount: '−$850.00',
                    icon: 'fuel',
                    variant: 'expense',
                  },
                ]}
              />
            </div>
            <div className="contents">
              <div className="flex items-center gap-3 self-start rounded-card bg-surface p-4">
                <span className="flex size-10 items-center justify-center rounded-xl bg-facet-2/15 text-facet-3 dark:text-facet-1">
                  <CalendarClock className="size-5" />
                </span>
                <span>
                  <span className="block text-xs text-on-surface-variant">
                    {t('upcoming')}
                  </span>
                  <span className="block text-sm font-bold text-on-background">
                    {t('upcomingValue')}
                  </span>
                </span>
              </div>
              <NeoTipCard
                title={t('tipTitle')}
                body={`${t('tipBody')} `}
                highlight={t('tipHighlight')}
                bodyAfterHighlight={` ${t('tipAfter')}`}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
