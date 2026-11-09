'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, Percent, Wallet } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import { Progress } from '@finnit/ui/components/ui/progress';

import { useNewEntry } from '@/components/new-entry/new-entry-context';
import type {
  CardPeriodTone,
  CardPeriodView,
} from '@finnit/core/accounts/card-period';

const BADGE: Record<
  CardPeriodTone,
  'muted' | 'highlight' | 'success' | 'expense'
> = {
  neutral: 'muted',
  warning: 'highlight',
  success: 'success',
  danger: 'expense',
};

/**
 * A credit card's billing cycle: its status, what to pay and by when, the
 * figures (full view) and the actions: "Pagar tarjeta" (a transfer to the
 * card with what is left) and, for an unpaid card added by hand,
 * "Registrar intereses" (an expense in Intereses, the estimate filled in).
 */
export function CardPeriodSummary({
  period,
  compact = false,
}: {
  period: CardPeriodView;
  /** The history's balance card: status, headline, progress and actions. */
  compact?: boolean;
}) {
  const t = useTranslations('cards.period');
  const openNewEntry = useNewEntry();

  const pay = period.pay;
  const interest = period.interest;
  const figures: { label: string; value: string }[] = [
    { label: period.balanceLabel, value: period.balance },
    ...(period.status === 'open'
      ? []
      : [
          { label: t('noInterest'), value: period.noInterestPayment },
          { label: t('paid'), value: period.paid },
          { label: t('remaining'), value: period.remaining },
        ]),
    ...(period.minimumPayment
      ? [{ label: t('minimum'), value: period.minimumPayment }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-glass-border bg-surface/60 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-on-surface-variant">
          {t('cycle', { range: period.range })}
        </p>
        <Badge variant={BADGE[period.tone]}>{period.statusLabel}</Badge>
      </div>
      <p className="text-sm font-semibold text-on-background">
        {period.headline}
      </p>
      {period.progress != null ? (
        <Progress
          value={period.progress}
          aria-label={t('progress', { percent: period.progress })}
        />
      ) : null}

      {!compact ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {figures.map((f) => (
            <div key={f.label} className="flex flex-col">
              <dt className="text-xs text-on-surface-variant">{f.label}</dt>
              <dd className="font-semibold tabular-nums text-on-background">
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {!compact && period.pendingInstallments ? (
        <p className="text-xs text-on-surface-variant">
          {t('pendingInstallments', { amount: period.pendingInstallments })}
        </p>
      ) : null}
      {!compact && period.fromStatement ? (
        <p className="text-xs text-on-surface-variant">{t('fromStatement')}</p>
      ) : null}

      {interest ? (
        <p className="text-xs text-on-surface-variant">
          {interest.estimate
            ? t('interestHint', { amount: interest.estimate })
            : t('interestNoRate')}
        </p>
      ) : null}

      {pay || interest || !compact ? (
        <div className="flex flex-wrap gap-2">
          {pay ? (
            <Button
              size="sm"
              onClick={() =>
                openNewEntry('transfer', {
                  transfer: { toAccountId: pay.accountId, amount: pay.amount },
                  cardDueDate: pay.dueDate,
                })
              }
            >
              <Wallet aria-hidden />
              {t('pay')}
            </Button>
          ) : null}
          {interest ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                openNewEntry('expense', {
                  entry: {
                    accountId: interest.accountId,
                    amount: interest.amount,
                    categoryId: interest.categoryId ?? undefined,
                    categoryPicked: Boolean(interest.categoryId),
                    merchant: t('interestName'),
                  },
                })
              }
            >
              <Percent aria-hidden />
              {t('recordInterest')}
            </Button>
          ) : null}
          {!compact ? (
            <Button size="sm" variant="ghost" asChild>
              <Link href={period.historyHref}>
                {t('movements')}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
