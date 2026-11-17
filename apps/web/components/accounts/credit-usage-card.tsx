'use client';

import { useTranslations } from 'next-intl';
import { PieChart } from 'lucide-react';

import { Card } from '@finnit/ui/components/ui/card';
import { InfoHint } from '@finnit/ui/components/ui/info-hint';

import type { CreditUsageView } from '@finnit/core/accounts/credit-usage';

const ONE_OFF = 'var(--chart-1)';
const INSTALLMENTS = 'var(--chart-2)';

/**
 * "Crédito utilizado", split: one-off spending (and installments already
 * billed) vs every installment of purchases in installments still to
 * bill, as a bar with both amounts.
 */
export function CreditUsageCard({ usage }: { usage: CreditUsageView }) {
  const t = useTranslations('accounts.creditUsage');
  return (
    <Card className="gap-3 rounded-[20px] p-4.5">
      <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-on-surface-variant">
        <PieChart aria-hidden className="size-4 text-brand-ink" />
        {t('title')}
        <InfoHint label={t('title')}>{t('hint')}</InfoHint>
      </h3>
      <div
        aria-hidden
        className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-track"
      >
        {usage.oneOffPercent > 0 ? (
          <span
            style={{ flexGrow: usage.oneOffPercent, background: ONE_OFF }}
          />
        ) : null}
        {usage.installmentsPercent > 0 ? (
          <span
            style={{
              flexGrow: usage.installmentsPercent,
              background: INSTALLMENTS,
            }}
          />
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5">
          <dt className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: ONE_OFF }}
            />
            {t('oneOff')}
          </dt>
          <dd className="text-lg font-bold text-on-background tabular-nums">
            {usage.oneOff}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: INSTALLMENTS }}
            />
            {t('installments')}
          </dt>
          <dd className="text-lg font-bold text-on-background tabular-nums">
            {usage.installments}
          </dd>
          <dd className="text-xs text-on-surface-variant">
            {t('plans', { count: usage.plans })}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
