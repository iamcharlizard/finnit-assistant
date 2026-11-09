'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';

import { BalanceCard } from '@finnit/ui/components/finance/balance-card';

import { AmountsToggle } from '@/components/privacy/amounts-visibility';
import type { DashboardView } from '@finnit/core/dashboard/view';

/**
 * Money available in the accounts that add up to the total, in a low strip:
 * the whole card opens "Cuentas y tarjetas"; the eye hides or shows every
 * amount on the home screen.
 */
export function BalanceSummary({
  balance,
}: {
  balance: NonNullable<DashboardView['balance']>;
}) {
  const t = useTranslations('dashboard.balance');
  return (
    <BalanceCard.Root className="relative flex items-center gap-3 p-4 transition-colors focus-within:ring-2 focus-within:ring-ring/50 hover:border-brand/30 @3xl:px-6">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium tracking-widest text-on-surface-variant uppercase">
          {t('available')}
        </p>
        <p className="truncate text-3xl font-bold text-on-background tabular-nums @3xl:text-4xl">
          <Link
            href="/accounts"
            className="outline-none after:absolute after:inset-0 after:rounded-card"
          >
            {balance.available}
          </Link>
        </p>
        {balance.otherCurrencies.length > 0 ? (
          <p className="mt-0.5 truncate text-xs text-on-surface-variant">
            {t('alsoIn', { list: balance.otherCurrencies.join(' · ') })}
          </p>
        ) : null}
      </div>
      <AmountsToggle />
      <ChevronRight
        aria-hidden
        className="size-5 shrink-0 text-on-surface-variant"
      />
    </BalanceCard.Root>
  );
}
