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
import { useSessionUser } from '@/components/session-provider';
import type { BudgetCardView } from '@/lib/budgets/view';
import { UPCOMING_DAYS, type DashboardView } from '@/lib/dashboard/view';

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
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
        {view.balance ? (
          <BalanceSummary balance={view.balance} />
        ) : (
          <EmptyState
            icon={Landmark}
            title={t('noAccountsTitle')}
            description={t('noAccountsDescription')}
            action={{
              href: '/settings/banks/connect',
              label: tc('connectBank'),
            }}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
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

        {budget ? <BudgetDashboardCard card={budget} /> : null}
      </div>

      <section className="min-w-0 lg:row-span-2">
        <SectionHeading
          title={t('upcoming')}
          action={
            <Link href="/recurring" className={LINK_CLASS}>
              {t('calendarLink')}
            </Link>
          }
        />
        {view.upcoming.length > 0 ? (
          <div className="flex flex-col gap-2">
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
        <div className="min-w-0 lg:col-span-2">
          <DashboardDebts
            insights={view.debts.insights}
            today={view.debts.today}
          />
        </div>
      ) : null}
    </div>
  );
}
