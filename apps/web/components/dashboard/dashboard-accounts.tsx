'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ChevronRight,
  CreditCard,
  Landmark,
  PiggyBank,
  Smartphone,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import type {
  DashboardAccount,
  DashboardView,
} from '@finnit/core/dashboard/view';

export const ACCOUNT_ICONS: Record<DashboardAccount['type'], LucideIcon> = {
  debit: Landmark,
  savings: PiggyBank,
  credit: CreditCard,
  cash: Wallet,
  ewallet: Smartphone,
};

/** Each type's color when the account has none of its own. */
const TYPE_COLORS: Record<DashboardAccount['type'], string> = {
  debit: 'var(--chart-1)',
  savings: 'var(--chart-3)',
  credit: 'var(--chart-2)',
  cash: 'var(--chart-4)',
  ewallet: 'var(--chart-5)',
};

const LINK_CLASS =
  'flex min-h-11 items-center text-sm font-medium text-income hover:underline';

/**
 * The accounts and their balances (those in the total first): a row opens
 * that account in "Cuentas y tarjetas"; "Ver todas" opens the list.
 */
export function DashboardAccounts({
  accounts,
  count,
}: {
  accounts: DashboardView['accounts'];
  count: number;
}) {
  const t = useTranslations('dashboard.accounts');
  return (
    <section
      aria-labelledby="dashboard-accounts"
      className="min-w-0 rounded-card border border-outline-variant bg-surface p-2 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 px-3">
        <h2
          id="dashboard-accounts"
          className="text-base font-semibold text-on-background"
        >
          {t('title')}
        </h2>
        <Link href="/accounts" className={LINK_CLASS}>
          {count > accounts.length ? t('seeAllCount', { count }) : t('seeAll')}
        </Link>
      </div>
      <ul className="flex flex-col">
        {accounts.map((account) => {
          const Icon = ACCOUNT_ICONS[account.type];
          return (
            <li key={account.id}>
              <Link
                href={`/accounts?account=${encodeURIComponent(account.id)}`}
                className="flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{
                    backgroundColor: account.color ?? TYPE_COLORS[account.type],
                  }}
                >
                  <Icon className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-on-background">
                    {account.name}
                  </span>
                  <span className="truncate text-xs text-on-surface-variant">
                    {account.last4 ? `•••• ${account.last4}` : null}
                    {account.last4 && account.excluded ? ' · ' : null}
                    {account.excluded ? t('excluded') : null}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-on-background tabular-nums">
                  {account.balance}
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-4 shrink-0 text-on-surface-variant"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
