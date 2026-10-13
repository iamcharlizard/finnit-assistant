'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { HandCoins, Landmark, Percent, Plus, Wallet } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { toast } from '@finnit/ui/components/ui/toaster';
import { cn } from '@finnit/ui/lib/utils';

import {
  ConfirmDialog,
  type ConfirmRequest,
} from '@/components/admin/confirm-dialog';
import { SummaryCard } from '@/components/recurring/summary-card';
import { debtErrorMessage, deleteDebt } from '@/lib/debts/api';
import type { DebtsScreenData } from '@/lib/debts/load';
import type { ApiDebt } from '@/lib/debts/types';
import type { DebtItem } from '@/lib/debts/view';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { DebtCard } from './debt-card';
import { DebtDialog } from './debt-dialog';
import { PaymentDialog } from './payment-dialog';
import { PayoffPlan } from './payoff-plan';

const RED = '#ba1a1a';
const TEAL = '#00696e';
const PURPLE = '#6c72cb';

/**
 * "Deudas": what is owed, every debt with its payments, and the plan to pay
 * them off (Avalanche vs Snowball).
 */
export function DebtsScreen({ data }: { data: DebtsScreenData }) {
  const { view, categories, plan } = data;
  const router = useRouter();
  const { t } = useLocalizer();
  const [pending, startTransition] = React.useTransition();
  const [editing, setEditing] = React.useState<{ debt: ApiDebt | null } | null>(
    null,
  );
  const [paying, setPaying] = React.useState<DebtItem | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const refresh = () => startTransition(() => router.refresh());

  function askDelete(item: DebtItem) {
    setConfirm({
      title: t('debts.delete.title', { name: item.name }),
      description: t('debts.delete.description'),
      confirmLabel: t('debts.delete.confirm'),
      destructive: true,
      onConfirm: async () => {
        setConfirm(null);
        setBusyId(item.id);
        try {
          await deleteDebt(item.id, gql);
          toast.success(t('debts.toasts.deleted', { name: item.name }));
          refresh();
        } catch (error) {
          toast.error(debtErrorMessage(error, t));
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function onSaved(changed: boolean, name: string) {
    const created = !editing?.debt;
    setEditing(null);
    if (!changed) {
      toast(t('debts.toasts.noChanges'));
      return;
    }
    toast.success(
      t(created ? 'debts.toasts.created' : 'debts.toasts.updated', { name }),
    );
    refresh();
  }

  function onPaid() {
    const item = paying;
    setPaying(null);
    if (item) toast.success(t('debts.toasts.paid', { name: item.name }));
    refresh();
  }

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
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] leading-9 font-bold text-brand-ink sm:text-[32px] sm:leading-10">
            {t('debts.title')}
          </h1>
          <p className="text-[15px] text-on-surface-variant">
            {t('debts.subtitle')}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setEditing({ debt: null })}
        >
          <Plus aria-hidden /> {t('debts.new')}
        </Button>
      </header>

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
          <Button
            type="button"
            variant="secondary"
            className="mt-2"
            onClick={() => setEditing({ debt: null })}
          >
            <Plus aria-hidden /> {t('debts.new')}
          </Button>
        </section>
      ) : (
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

          <section aria-labelledby="debts-list" className="flex flex-col gap-3">
            <h2
              id="debts-list"
              className="px-1 text-lg font-bold text-on-background sm:text-xl"
            >
              {t('debts.list.title')}
            </h2>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {view.debts.map((item) => (
                <DebtCard
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onPay={() => setPaying(item)}
                  onEdit={() => setEditing({ debt: item.debt })}
                  onDelete={() => askDelete(item)}
                />
              ))}
            </ul>
          </section>

          <PayoffPlan
            debtIds={view.activeIds}
            stamp={stamp}
            initial={plan}
            today={view.today}
          />
        </div>
      )}

      {editing ? (
        <DebtDialog
          debt={editing.debt}
          accounts={view.accounts}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      ) : null}
      {paying ? (
        <PaymentDialog
          item={paying}
          accounts={view.accounts}
          categories={categories}
          today={view.today}
          onClose={() => setPaying(null)}
          onSaved={onPaid}
        />
      ) : null}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
