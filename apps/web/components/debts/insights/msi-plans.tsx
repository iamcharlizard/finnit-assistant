'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CreditCard } from 'lucide-react';

import { Progress } from '@finnit/ui/components/ui/progress';

import type { MsiRow } from '@/lib/debts/insights-view';

/**
 * Card purchases in interest-free (or with-interest) monthly installments.
 * They live in recurring payments and use the card's credit line, so they
 * are listed apart from loans.
 */
export function MsiPlans({ rows }: { rows: MsiRow[] }) {
  const t = useTranslations('debts.msi');
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="msi-plans" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2
          id="msi-plans"
          className="text-lg font-bold text-on-background sm:text-xl"
        >
          {t('title')}
        </h2>
        <Link
          href="/recurring?tab=list"
          className="text-xs font-medium text-income hover:underline"
        >
          {t('manage')}
        </Link>
      </div>
      <p className="px-1 text-xs text-on-surface-variant">{t('hint')}</p>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-col gap-2 rounded-card border border-outline bg-surface p-4"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-chip bg-track text-on-surface-variant"
              >
                <CreditCard className="size-4" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <h3 className="truncate text-sm font-bold text-on-background">
                  {row.name}
                </h3>
                {row.accountName ? (
                  <p className="truncate text-xs text-on-surface-variant">
                    {row.accountName}
                  </p>
                ) : null}
              </div>
              <span className="text-sm font-bold text-on-background tabular-nums">
                {row.remaining}
              </span>
            </div>
            <Progress
              value={row.paidPercent}
              indicatorColor="var(--chart-6)"
              aria-label={row.progress}
              className="h-1.5"
            />
            <p className="text-xs text-on-surface-variant">
              {[
                row.progress,
                t('installment', { amount: row.installment }),
                row.nextLabel ? t('next', { date: row.nextLabel }) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
