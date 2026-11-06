'use client';

import { CalendarClock, Landmark, Wallet } from 'lucide-react';

import { SummaryCard } from '@/components/recurring/summary-card';
import type { BudgetCategory } from '@/lib/budgets/types';
import type { ApiDebtInsights } from '@/lib/debts/types';
import type { DebtsView } from '@/lib/debts/view';
import { useLocalizer } from '@/lib/i18n/client';
import { DebtList } from './debt-list';
import { DebtInsights } from './insights/debt-insights';

const RED = '#ba1a1a';
const TEAL = '#00696e';
const PURPLE = '#6c72cb';

/**
 * The "Préstamos" tab of Deudas: what the loans add up to (owed, monthly
 * payments, next payment), their charts, and every loan labeled with its
 * type (bank or lender, personal, buy now pay later).
 */
export function LoansTab({
  view,
  insights,
  categories,
  onChanged,
  empty,
}: {
  view: DebtsView;
  insights: ApiDebtInsights;
  categories: BudgetCategory[];
  onChanged: () => void;
  /** Shown without loans. */
  empty: React.ReactNode;
}) {
  const { t } = useLocalizer();
  if (view.debts.length === 0) return empty;

  // Soonest next payment among the loans still owed.
  const next = view.debts
    .filter((d) => !d.paidOff && d.debt.nextPaymentDate)
    .sort((a, b) =>
      a.debt.nextPaymentDate!.localeCompare(b.debt.nextPaymentDate!),
    )[0];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={Wallet}
          accent={RED}
          label={t('loans.summary.owed')}
          amount={view.totals.owed}
          detail={t('debts.summary.owedDetail', {
            count: view.totals.active,
            paidOff: view.totals.paidOff,
          })}
        />
        <SummaryCard
          icon={Landmark}
          accent={TEAL}
          label={t('loans.summary.monthly')}
          amount={view.totals.minimums}
          detail={t('loans.summary.monthlyDetail')}
        />
        <SummaryCard
          icon={CalendarClock}
          accent={PURPLE}
          label={t('loans.summary.next')}
          amount={next?.nextPayment ?? '—'}
          detail={next ? next.name : t('loans.summary.noNext')}
        />
      </div>

      <section aria-labelledby="loans-list" className="flex flex-col gap-3">
        <h2
          id="loans-list"
          className="px-1 text-lg font-bold text-on-background sm:text-xl"
        >
          {t('loans.listTitle')}
        </h2>
        <DebtList
          items={view.debts}
          accounts={view.accounts}
          categories={categories}
          today={view.today}
          onChanged={onChanged}
        />
      </section>

      <DebtInsights
        data={insights}
        today={view.today}
        title={t('loans.insightsTitle')}
      />
    </div>
  );
}
