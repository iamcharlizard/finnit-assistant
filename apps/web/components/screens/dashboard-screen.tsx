'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CalendarCheck, Landmark } from 'lucide-react';

import { SectionHeading } from '@finnit/ui/components/ui/section-heading';
import { cn } from '@finnit/ui/lib/utils';

import { BudgetDashboardCard } from '@/components/budgets/budget-dashboard-card';
import { BalanceSummary } from '@/components/dashboard/balance-summary';
import { DashboardAccounts } from '@/components/dashboard/dashboard-accounts';
import { DashboardDebts } from '@/components/dashboard/dashboard-debts';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { DashboardWelcome } from '@/components/dashboard/dashboard-welcome';
import { EmptyState } from '@/components/finance/empty-state';
import { PaymentRow } from '@/components/finance/payment-row';
import { PageHeader } from '@/components/page-header';
import { useAmountsVisibility } from '@/components/privacy/amounts-visibility';
import { useSessionUser } from '@/components/session-provider';
import type { BudgetCardView } from '@finnit/core/budgets/view';
import {
  UPCOMING_DAYS,
  maskDashboardView,
  type DashboardView,
} from '@finnit/core/dashboard/view';

const LINK_CLASS =
  'flex min-h-11 items-center text-sm font-medium text-income hover:underline';

/**
 * A column at @6xl; below it its children join the screen's single column
 * (display: contents) so `order-*` interleaves both columns' blocks.
 */
const COLUMN = 'contents @6xl:flex @6xl:min-w-0 @6xl:flex-col @6xl:gap-4';

export function DashboardScreen({
  view: fullView,
  budget = null,
}: {
  view: DashboardView;
  /** The current month's budget, when there is one. */
  budget?: BudgetCardView | null;
}) {
  const user = useSessionUser();
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const { hidden } = useAmountsVisibility();
  const firstName = user.name.split(' ')[0] ?? user.name;
  const view = hidden ? maskDashboardView(fullView) : fullView;

  // The greeting is the screen's header (so the generic "Finnit" bar is
  // hidden); the welcome card goes under it.
  if (view.isEmpty) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t('greeting', { name: firstName })} />
        <DashboardWelcome />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('greeting', { name: firstName })}
        subtitle={view.todayLabel}
      />
      {/*
        Laid out by the content column's width (container queries), so it
        reflows when the sidebar collapses. One column on phones, in this
        order: balance, analytics, accounts, budget, payments, debts. From
        @6xl, two columns: the main one (balance, analytics, budget, debts)
        and a side one (accounts, upcoming payments).
      */}
      <div className="flex flex-col gap-4 @6xl:flex-row @6xl:items-start @6xl:gap-6">
        <div className={cn(COLUMN, '@6xl:flex-1')}>
          <div className="order-1 min-w-0 [view-transition-name:dash-balance] @6xl:order-none">
            {view.balance ? (
              <BalanceSummary balance={view.balance} />
            ) : (
              <EmptyState
                icon={Landmark}
                title={t('noAccountsTitle')}
                description={t('noAccountsDescription')}
                action={{
                  href: '/accounts?add=bank',
                  label: tc('connectBank'),
                }}
              />
            )}
          </div>

          <div className="order-2 min-w-0 [view-transition-name:dash-stats] @6xl:order-none">
            <DashboardStats stats={view.stats} />
          </div>

          {budget ? (
            <div className="order-4 min-w-0 [view-transition-name:dash-budget] @6xl:order-none">
              <BudgetDashboardCard card={budget} />
            </div>
          ) : null}

          {view.debts ? (
            <div className="order-6 mt-2 min-w-0 [view-transition-name:dash-debts] @6xl:order-none">
              <DashboardDebts
                insights={view.debts.insights}
                today={view.debts.today}
                hidden={hidden}
              />
            </div>
          ) : null}
        </div>

        <div className={cn(COLUMN, '@6xl:w-80 @6xl:shrink-0 @7xl:w-96')}>
          {view.accounts.length > 0 ? (
            <div className="order-3 min-w-0 [view-transition-name:dash-accounts] @6xl:order-none">
              <DashboardAccounts
                accounts={view.accounts}
                count={view.accountCount}
              />
            </div>
          ) : null}

          <section className="order-5 min-w-0 [view-transition-name:dash-upcoming] @6xl:order-none">
            <SectionHeading
              title={t('upcoming')}
              action={
                <Link href="/recurring" className={LINK_CLASS}>
                  {t('calendarLink')}
                </Link>
              }
            />
            {view.upcoming.length > 0 ? (
              <div className="grid gap-2 @3xl:grid-cols-2 @6xl:grid-cols-1">
                {view.upcoming.map((row) => (
                  <PaymentRow key={row.id} row={row} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CalendarCheck}
                title={t('noUpcomingTitle')}
                description={t('noUpcomingDescription', {
                  days: String(UPCOMING_DAYS),
                })}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
