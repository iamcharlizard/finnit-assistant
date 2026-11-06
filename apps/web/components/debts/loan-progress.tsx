'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { DonutRing } from '@finnit/ui/components/finance/donut-ring';
import { InfoHint } from '@finnit/ui/components/ui/info-hint';

import { ChartTooltip } from '@/components/debts/insights/chart-tooltip';
import type { LoanOutstanding, LoanPaidShare } from '@finnit/core/debts/detail-view';

const PAID = 'var(--income)';
const PENDING = 'var(--track)';

/**
 * The loan at a glance: a donut of paid vs everything owed, and what is
 * left: the principal (about what paying it off today takes) and the
 * balance with interest, VAT and fees, split in a stacked bar.
 */
export function LoanProgress({
  share,
  outstanding,
  historicalPaid,
  next,
  lender,
}: {
  share: LoanPaidShare;
  outstanding: LoanOutstanding;
  /** Paid before registering it, or null. */
  historicalPaid: string | null;
  /** "Próximo pago: …", or null. */
  next: string | null;
  lender: string | null;
}) {
  const t = useTranslations('debts.detail.summary');

  return (
    <div className="grid gap-3 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section
        aria-labelledby="loan-paid-share"
        className="flex flex-col gap-4 rounded-card border border-outline bg-surface p-4"
      >
        <h2
          id="loan-paid-share"
          className="text-sm font-bold text-on-background"
        >
          {t('paidTitle')}
        </h2>
        <div className="flex flex-wrap items-center gap-5">
          <div
            role="img"
            aria-label={t('paidAria', {
              percent: share.percent,
              paid: share.paidLabel,
              total: share.totalLabel,
            })}
            className="relative size-[140px] shrink-0"
          >
            <DonutRing
              percentage={share.percent}
              fillColor={PAID}
              trackColor={PENDING}
              strokeWidth={14}
            />
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-on-background tabular-nums">
                {share.percent}%
              </span>
              <span className="text-xs text-on-surface-variant">
                {t('paidCenter')}
              </span>
            </span>
          </div>
          <dl className="flex min-w-40 flex-1 flex-col gap-2 text-sm">
            <LegendRow
              color={PAID}
              label={t('paid')}
              value={share.paidLabel}
              hint={
                historicalPaid ? (
                  <InfoHint label={t('paidInfo')}>
                    {t('historical', { amount: historicalPaid })}
                  </InfoHint>
                ) : null
              }
            />
            <LegendRow
              color={PENDING}
              label={t('pending')}
              value={share.pendingLabel}
            />
            <div className="flex items-baseline justify-between gap-3 border-t border-outline pt-2">
              <dt className="text-on-surface-variant">{t('total')}</dt>
              <dd className="font-bold text-on-background tabular-nums">
                {share.totalLabel}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section
        aria-labelledby="loan-outstanding"
        className="flex flex-col gap-4 rounded-card border border-outline bg-surface p-4"
      >
        <h2
          id="loan-outstanding"
          className="text-sm font-bold text-on-background"
        >
          {t('outstandingTitle')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat
            label={t('payoff')}
            value={outstanding.payoffLabel}
            hint={
              <InfoHint label={t('payoffInfo')}>
                <span className="flex flex-col gap-2">
                  <span>
                    {outstanding.estimated
                      ? t('payoffEstimated')
                      : t('payoffHint')}
                  </span>
                  {outstanding.savingLabel ? (
                    <span>
                      {t('saving', {
                        amount: outstanding.savingLabel,
                        lender: lender ?? t('lenderFallback'),
                      })}
                    </span>
                  ) : null}
                </span>
              </InfoHint>
            }
          />
          <Stat
            label={t('withInterest')}
            value={outstanding.totalLabel}
            hint={
              <InfoHint label={t('withInterestInfo')}>
                {t('withInterestHint')}
              </InfoHint>
            }
          />
        </div>
        {outstanding.parts.length > 0 ? (
          <OutstandingBar outstanding={outstanding} />
        ) : null}
        {next ? (
          <p className="text-xs font-medium text-on-background">{next}</p>
        ) : null}
      </section>
    </div>
  );
}

function LegendRow({
  color,
  label,
  value,
  hint,
}: {
  color: string;
  label: string;
  value: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-on-surface-variant">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full border border-outline"
          style={{ background: color }}
        />
        {label}
        {hint}
      </dt>
      <dd className="font-medium text-on-background tabular-nums">{value}</dd>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-xs text-on-surface-variant">
        {label}
        {hint}
      </span>
      <span className="text-2xl font-bold text-on-background tabular-nums">
        {value}
      </span>
    </div>
  );
}

/** Principal, interest, VAT and fees left, as one stacked bar + legend. */
function OutstandingBar({ outstanding }: { outstanding: LoanOutstanding }) {
  const t = useTranslations('debts.detail.summary');
  const [active, setActive] = React.useState<string | null>(null);
  const part = outstanding.parts.find((p) => p.key === active);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        {part ? (
          <ChartTooltip
            title={t(`parts.${part.key}`)}
            rows={[
              {
                key: 'amount',
                label: t('share', { percent: Math.round(part.percent) }),
                value: part.amountLabel,
                color: part.color,
              },
            ]}
            className="left-1/2 -translate-x-1/2"
          />
        ) : null}
        <div
          role="img"
          aria-label={outstanding.parts
            .map((p) => `${t(`parts.${p.key}`)} ${p.amountLabel}`)
            .join(', ')}
          className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
        >
          {outstanding.parts.map((p) => (
            <div
              key={p.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${Math.max(1, p.percent)}%`,
                background: p.color,
              }}
              onMouseEnter={() => setActive(p.key)}
              onMouseLeave={() => setActive(null)}
            />
          ))}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
        {outstanding.parts.map((p) => (
          <div
            key={p.key}
            tabIndex={0}
            onFocus={() => setActive(p.key)}
            onBlur={() => setActive(null)}
            onMouseEnter={() => setActive(p.key)}
            onMouseLeave={() => setActive(null)}
            className="flex flex-col rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <dt className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: p.color }}
              />
              {t(`parts.${p.key}`)}
            </dt>
            <dd className="font-medium text-on-background tabular-nums">
              {p.amountLabel}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
