'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CalendarCheck, Landmark } from 'lucide-react';

import { StatCard } from '@finnit/ui/components/finance/stat-card';
import { SectionHeading } from '@finnit/ui/components/ui/section-heading';

import { BudgetDashboardCard } from '@/components/budgets/budget-dashboard-card';
import { BalanceSummary } from '@/components/dashboard/balance-summary';
import { DashboardDebts } from '@/components/dashboard/dashboard-debts';
import { DashboardWelcome } from '@/components/dashboard/dashboard-welcome';
import { EmptyState } from '@/components/finance/empty-state';
import { PaymentRow } from '@/components/finance/payment-row';
import { PageHeader } from '@/components/page-header';
import { useSessionUser } from '@/components/session-provider';
import type { BudgetCardView } from '@finnit/core/budgets/view';
import { UPCOMING_DAYS, type DashboardView } from '@finnit/core/dashboard/view';

const LINK_CLASS =
  'flex min-h-11 items-center text-sm font-medium text-income hover:underline';

export function DashboardScreen({
  view,
  budget = null,
}: {
  view: DashboardView;
  /** The current month's budget, when there is one. */
  budget?: BudgetCardView | null;
}) {
  const user = useSessionUser();
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const firstName = user.name.split(' ')[0] ?? user.name;

  if (view.isEmpty) return <DashboardWelcome firstName={firstName} />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('greeting', { name: firstName })}
        subtitle={view.todayLabel}
      />
      {/*
        Laid out by the content column's width (container queries), so it
        reflows when the sidebar collapses. DOM order is the phone order.
        - @3xl: two columns (balance | income and expenses stacked); the rest
          full width, upcoming payments two per row.
        - @6xl: three (cards on two, "Próximos pagos" as a column).
        - @7xl: four (balance on two, income/expenses, payments column).
      */}
      <div className="grid gap-4 @3xl:grid-cols-2 @3xl:gap-x-6 @6xl:grid-cols-3 @7xl:grid-cols-4">
        <div className="min-w-0 [view-transition-name:dash-balance] @6xl:col-span-2">
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

        <div className="grid min-w-0 gap-3 [view-transition-name:dash-month] sm:grid-cols-2 @3xl:grid-cols-1 @6xl:col-span-2 @6xl:grid-cols-2 @7xl:col-span-1 @7xl:grid-cols-1">
          <StatCard
            variant="income"
            label={t('incomeOf', { month: view.month.label })}
            amount={view.month.income}
          />
          <StatCard
            variant="expense"
            label={t('expensesOf', { month: view.month.label })}
            amount={view.month.expenses}
          />
        </div>

        {budget ? (
          <div className="min-w-0 [view-transition-name:dash-budget] @3xl:col-span-2 @7xl:col-span-3">
            <BudgetDashboardCard card={budget} />
          </div>
        ) : null}

        <section className="min-w-0 self-start [view-transition-name:dash-upcoming] @3xl:col-span-2 @6xl:col-span-1 @6xl:col-start-3 @6xl:row-span-4 @6xl:row-start-1 @7xl:col-start-4">
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

        {view.debts ? (
          <div className="mt-2 min-w-0 [view-transition-name:dash-debts] @3xl:col-span-2 @7xl:col-span-3">
            <DashboardDebts
              insights={view.debts.insights}
              today={view.debts.today}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
