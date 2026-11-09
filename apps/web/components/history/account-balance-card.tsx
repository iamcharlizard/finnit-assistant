'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronRight, CreditCard, Wallet } from 'lucide-react';

import { Card } from '@finnit/ui/components/ui/card';
import { Progress } from '@finnit/ui/components/ui/progress';
import { cn } from '@finnit/ui/lib/utils';

import { CardPeriodSummary } from '@/components/accounts/card-period-summary';
import type { HistoryAccountCard } from '@finnit/core/history/request';

/**
 * The history filtered by one account: its balance now. A credit card shows
 * what is owed, its limit and the cycle whose payment is due (with "Pagar
 * tarjeta").
 */
export function AccountBalanceCard({ card }: { card: HistoryAccountCard }) {
  const t = useTranslations('history.accountCard');
  const Icon = card.credit ? CreditCard : Wallet;
  const title = card.credit
    ? card.inFavor
      ? t('inFavor')
      : t('debt')
    : t('balance');

  return (
    <Card className="gap-3 rounded-card p-4.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-on-background">
          <Icon aria-hidden className="size-4 shrink-0 text-brand-ink" />
          <span className="truncate">{card.label}</span>
        </h2>
        <Link
          href={card.href}
          className="flex shrink-0 items-center gap-0.5 rounded-md text-xs font-medium text-brand-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {t('seeAccount')}
          <ChevronRight aria-hidden className="size-3.5" />
        </Link>
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-on-surface-variant">
          {title}
        </p>
        <p
          className={cn(
            'text-2xl font-bold tabular-nums text-on-background',
            (card.negative || (card.credit && !card.inFavor)) && 'text-expense',
            card.inFavor && 'text-income',
          )}
        >
          {card.balance}
        </p>
      </div>

      {card.credit && card.usedPercent != null ? (
        <div className="flex flex-col gap-1.5">
          <Progress
            value={card.usedPercent}
            aria-label={t('used', { percent: card.usedPercent })}
            indicatorColor={
              card.usedPercent >= 90 ? 'var(--expense)' : undefined
            }
          />
          <p className="text-xs text-on-surface-variant">
            {t('available', {
              available: card.available ?? '—',
              limit: card.limit ?? '—',
            })}
          </p>
        </div>
      ) : null}

      {card.period ? (
        <CardPeriodSummary period={card.period} compact />
      ) : card.needsTerms ? (
        <p className="text-xs text-on-surface-variant">
          {t('needsTerms')}{' '}
          <Link
            href={card.href}
            className="font-medium text-brand-ink hover:underline"
          >
            {t('setTerms')}
          </Link>
        </p>
      ) : null}
    </Card>
  );
}
