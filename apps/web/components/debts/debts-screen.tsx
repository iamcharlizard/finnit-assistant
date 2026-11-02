'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
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
import { toast } from '@finnit/ui/components/ui/toaster';
import { cn } from '@finnit/ui/lib/utils';

import { PageHeader } from '@/components/page-header';
import { SummaryCard } from '@/components/recurring/summary-card';
import type { DebtsScreenData } from '@/lib/debts/load';
import { LOANS_PATH } from '@/lib/debts/view';
import { useLocalizer } from '@/lib/i18n/client';
import { DebtDialog } from './debt-dialog';
import { DebtList } from './debt-list';
import { DebtInsights } from './insights/debt-insights';
import { LoanDialog } from './loan-dialog';
import { PayoffPlan } from './payoff-plan';

const RED = '#ba1a1a';
const TEAL = '#00696e';
const PURPLE = '#6c72cb';

/**
 * "Deudas": everything owed (loans included in the totals, the charts and
 * the payoff plan), the cards and other debts one by one, and card MSI
 * plans. Loans are listed on their own page.
 */
export function DebtsScreen({ data }: { data: DebtsScreenData }) {
  const { view, insights, categories, plan } = data;
  const router = useRouter();
  const { t } = useLocalizer();
  const [pending, startTransition] = React.useTransition();
  const [creating, setCreating] = React.useState(false);
  const [creatingLoan, setCreatingLoan] = React.useState(false);

  const refresh = () => startTransition(() => router.refresh());
  const others = view.debts.filter((d) => d.kind !== 'loan');
  const loans = view.debts.filter((d) => d.kind === 'loan');
  const activeLoans = loans.filter((d) => !d.paidOff).length;

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
    router.push(`${LOANS_PATH}/${id}`);
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

          {loans.length > 0 ? (
            <Link
              href={LOANS_PATH}
              className="flex items-center gap-3 rounded-card border border-outline bg-surface p-4 hover:bg-accent"
            >
              <HandCoins
                aria-hidden
                className="size-5 text-on-surface-variant"
              />
              <span className="flex-1 text-sm text-on-background">
                {t('debts.loansLink', {
                  count: loans.length,
                  active: activeLoans,
                })}
              </span>
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          ) : null}

          {others.length > 0 ? (
            <section
              aria-labelledby="debts-list"
              className="flex flex-col gap-3"
            >
              <h2
                id="debts-list"
                className="px-1 text-lg font-bold text-on-background sm:text-xl"
              >
                {t('debts.list.title')}
              </h2>
              <DebtList
                items={others}
                accounts={view.accounts}
                categories={categories}
                today={view.today}
                onChanged={refresh}
              />
            </section>
          ) : null}

          <DebtInsights data={insights} today={view.today} />

          <PayoffPlan
            debtIds={view.activeIds}
            stamp={stamp}
            initial={plan}
            today={view.today}
          />
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
