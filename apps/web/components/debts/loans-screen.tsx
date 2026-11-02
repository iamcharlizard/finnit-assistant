'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, HandCoins, Landmark, Plus, Wallet } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@finnit/ui/components/ui/tabs';
import { toast } from '@finnit/ui/components/ui/toaster';
import { cn } from '@finnit/ui/lib/utils';

import { PageHeader } from '@/components/page-header';
import { SummaryCard } from '@/components/recurring/summary-card';
import type { LoansScreenData } from '@/lib/debts/load';
import { LOANS_PATH } from '@/lib/debts/view';
import { useLocalizer } from '@/lib/i18n/client';
import { DebtList } from './debt-list';
import { DebtInsights } from './insights/debt-insights';
import { LoanDialog } from './loan-dialog';

const RED = '#ba1a1a';
const TEAL = '#00696e';
const PURPLE = '#6c72cb';

/**
 * "Préstamos": two tabs. Analysis (first): what the loans add up to and
 * their charts. Loans: every loan together, each card labeled with its
 * type (bank or lender, personal, buy now pay later).
 */
export function LoansScreen({ data }: { data: LoansScreenData }) {
  const { view, insights, categories } = data;
  const router = useRouter();
  const { t } = useLocalizer();
  const [pending, startTransition] = React.useTransition();
  const [creating, setCreating] = React.useState(false);
  const [tab, setTab] = React.useState('analysis');

  const refresh = () => startTransition(() => router.refresh());

  // Soonest next payment among the loans still owed.
  const next = view.debts
    .filter((d) => !d.paidOff && d.debt.nextPaymentDate)
    .sort((a, b) =>
      a.debt.nextPaymentDate!.localeCompare(b.debt.nextPaymentDate!),
    )[0];

  function onSaved(id: string, name: string) {
    setCreating(false);
    toast.success(t('debts.toasts.created', { name }));
    router.push(`${LOANS_PATH}/${id}`);
  }

  const newButton = (
    <Button type="button" variant="secondary" onClick={() => setCreating(true)}>
      <Plus aria-hidden /> {t('loans.new')}
    </Button>
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t('loans.title')}
        subtitle={t('loans.subtitle')}
        actions={newButton}
      />

      {view.debts.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-card border border-dashed border-on-background/12 px-6 py-10 text-center">
          <HandCoins
            aria-hidden
            className="size-10 text-on-surface-variant/50"
          />
          <h2 className="text-base font-medium text-on-background">
            {t('loans.empty.title')}
          </h2>
          <p className="max-w-md text-sm text-on-surface-variant">
            {t('loans.empty.description')}
          </p>
          <div className="mt-2">{newButton}</div>
        </section>
      ) : (
        <div
          aria-busy={pending}
          className={cn(
            'flex flex-col gap-8 transition-opacity',
            pending && 'opacity-60',
          )}
        >
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="self-start">
              <TabsTrigger value="analysis">
                {t('loans.tabs.analysis')}
              </TabsTrigger>
              <TabsTrigger value="list">
                {t('loans.tabs.list', { count: view.debts.length })}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="analysis" className="flex flex-col gap-8">
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

              <DebtInsights
                data={insights}
                today={view.today}
                title={t('loans.insightsTitle')}
              />
            </TabsContent>

            <TabsContent value="list">
              {/* Every loan together; each card says its type. */}
              <DebtList
                items={view.debts}
                accounts={view.accounts}
                categories={categories}
                today={view.today}
                onChanged={refresh}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {creating ? (
        <LoanDialog
          accounts={view.accounts}
          categories={categories}
          today={view.today}
          onClose={() => setCreating(false)}
          onSaved={onSaved}
        />
      ) : null}
    </div>
  );
}
