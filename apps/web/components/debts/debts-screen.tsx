'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  CreditCard,
  HandCoins,
  Landmark,
  Percent,
  Plus,
  Wallet,
} from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@finnit/ui/components/ui/dropdown-menu';
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
import type { DebtTab, DebtsScreenData } from '@/lib/debts/load';
import { DEBTS_PATH } from '@finnit/core/debts/view';
import { useLocalizer } from '@/lib/i18n/client';
import { DebtDialog } from './debt-dialog';
import { DebtList } from './debt-list';
import { DebtInsights } from './insights/debt-insights';
import { LoanDialog } from './loan-dialog';
import { LoansTab } from './loans-tab';
import { PayoffPlan } from './payoff-plan';

const RED = '#ba1a1a';
const TEAL = '#00696e';
const PURPLE = '#6c72cb';

/**
 * "Deudas", in three tabs: Resumen (everything owed, loans included: totals,
 * charts, card MSI plans and the payoff plan), Préstamos (the loans and
 * their charts) and Tarjetas y otras (each card or other debt). The tab is
 * in the URL (?tab=).
 */
export function DebtsScreen({
  data,
  initialTab,
}: {
  data: DebtsScreenData;
  initialTab: DebtTab;
}) {
  const { view, loansView, insights, loanInsights, categories, plan } = data;
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = React.useState<DebtTab>(initialTab);
  const changeTab = (next: string) => {
    setTab(next as DebtTab);
    // Shareable without a server round trip.
    window.history.replaceState(
      null,
      '',
      next === 'summary' ? pathname : `${pathname}?tab=${next}`,
    );
  };
  const { t } = useLocalizer();
  const [pending, startTransition] = React.useTransition();
  const [creating, setCreating] = React.useState(false);
  const [creatingLoan, setCreatingLoan] = React.useState(false);

  const refresh = () => startTransition(() => router.refresh());
  const others = view.debts.filter((d) => d.kind !== 'loan');

  function onCreated(changed: boolean, name: string) {
    setCreating(false);
    if (changed) {
      toast.success(t('debts.toasts.created', { name }));
      refresh();
    }
  }

  function onLoanSaved(id: string, name: string) {
    setCreatingLoan(false);
    toast.success(t('debts.toasts.created', { name }));
    router.push(`${DEBTS_PATH}/${id}`);
  }

  const newButton = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary">
          <Plus aria-hidden /> {t('debts.new')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setCreatingLoan(true)}>
          <Landmark aria-hidden /> {t('debts.newLoan')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setCreating(true)}>
          <CreditCard aria-hidden /> {t('debts.newOther')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Changes whenever a number the plan depends on does.
  const stamp = view.debts
    .filter((d) => !d.paidOff)
    .map(
      (d) =>
        `${d.id}:${d.debt.remainingBalance}:${d.debt.minPaymentAmount ?? ''}:${d.debt.interestRateAnnual ?? ''}`,
    )
    .join(',');
  const totals = view.totals;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t('debts.title')}
        subtitle={t('debts.subtitle')}
        actions={newButton}
      />

      {view.debts.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-card border border-dashed border-on-background/12 px-6 py-10 text-center">
          <HandCoins
            aria-hidden
            className="size-10 text-on-surface-variant/50"
          />
          <h2 className="text-base font-medium text-on-background">
            {t('debts.empty.title')}
          </h2>
          <p className="max-w-md text-sm text-on-surface-variant">
            {t('debts.empty.description')}
          </p>
          <div className="mt-2">{newButton}</div>
        </section>
      ) : null}
      {view.debts.length === 0 && insights.msi.length > 0 ? (
        // Card MSI plans still show (and chart) without any debt.
        <DebtInsights data={insights} today={view.today} />
      ) : null}
      {view.debts.length === 0 ? null : (
        <div
          aria-busy={pending}
          className={cn(
            'flex flex-col gap-8 transition-opacity',
            pending && 'opacity-60',
          )}
        >
          <Tabs value={tab} onValueChange={changeTab}>
            <TabsList className="self-start">
              <TabsTrigger value="summary">
                {t('debts.tabs.summary')}
              </TabsTrigger>
              <TabsTrigger value="loans">
                {t('debts.tabs.loans', { count: loansView.debts.length })}
              </TabsTrigger>
              <TabsTrigger value="other">
                {t('debts.tabs.other', { count: others.length })}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-6 flex flex-col gap-8">
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryCard
                  icon={Wallet}
                  accent={RED}
                  label={t('debts.summary.owed')}
                  amount={totals.owed}
                  detail={t('debts.summary.owedDetail', {
                    count: totals.active,
                    paidOff: totals.paidOff,
                  })}
                />
                <SummaryCard
                  icon={Landmark}
                  accent={TEAL}
                  label={t('debts.summary.minimums')}
                  amount={totals.minimums}
                  detail={t('debts.summary.minimumsDetail')}
                />
                <SummaryCard
                  icon={Percent}
                  accent={PURPLE}
                  label={t('debts.summary.rate')}
                  amount={totals.weightedRate ?? '—'}
                  detail={
                    totals.weightedRate === null
                      ? t('debts.summary.rateUnknown')
                      : totals.withoutRate > 0
                        ? t('debts.summary.rateMissing', {
                            count: totals.withoutRate,
                          })
                        : t('debts.summary.rateDetail')
                  }
                />
              </div>

              <DebtInsights data={insights} today={view.today} />

              <PayoffPlan
                debtIds={view.activeIds}
                stamp={stamp}
                initial={plan}
                today={view.today}
              />
            </TabsContent>

            <TabsContent value="loans" className="mt-6">
              <LoansTab
                view={loansView}
                insights={loanInsights}
                categories={categories}
                onChanged={refresh}
                empty={
                  <EmptyTab
                    title={t('loans.empty.title')}
                    description={t('loans.empty.description')}
                    action={
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setCreatingLoan(true)}
                      >
                        <Plus aria-hidden /> {t('loans.new')}
                      </Button>
                    }
                  />
                }
              />
            </TabsContent>

            <TabsContent value="other" className="mt-6">
              {others.length > 0 ? (
                <DebtList
                  items={others}
                  accounts={view.accounts}
                  categories={categories}
                  today={view.today}
                  onChanged={refresh}
                />
              ) : (
                <EmptyTab
                  title={t('debts.otherEmpty.title')}
                  description={t('debts.otherEmpty.description')}
                  action={
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setCreating(true)}
                    >
                      <Plus aria-hidden /> {t('debts.newOther')}
                    </Button>
                  }
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {creating ? (
        <DebtDialog
          debt={null}
          accounts={view.accounts}
          onClose={() => setCreating(false)}
          onSaved={onCreated}
        />
      ) : null}
      {creatingLoan ? (
        <LoanDialog
          accounts={view.accounts}
          categories={categories}
          today={view.today}
          onClose={() => setCreatingLoan(false)}
          onSaved={onLoanSaved}
        />
      ) : null}
    </div>
  );
}

function EmptyTab({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-card border border-dashed border-on-background/12 px-6 py-10 text-center">
      <HandCoins aria-hidden className="size-10 text-on-surface-variant/50" />
      <h2 className="text-base font-medium text-on-background">{title}</h2>
      <p className="max-w-md text-sm text-on-surface-variant">{description}</p>
      <div className="mt-2">{action}</div>
    </section>
  );
}
