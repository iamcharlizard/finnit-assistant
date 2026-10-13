'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { toast } from '@finnit/ui/components/ui/toaster';
import { cn } from '@finnit/ui/lib/utils';

import {
  ConfirmDialog,
  type ConfirmRequest,
} from '@/components/admin/confirm-dialog';
import { MonthSwitcher } from '@/components/finance/month-switcher';
import {
  budgetErrorMessage,
  copyBudget,
  deleteBudget,
  type BudgetTarget,
} from '@/lib/budgets/api';
import {
  emptyBudgetForm,
  formOfBudget,
  formOfSuggestions,
  type BudgetForm,
} from '@/lib/budgets/form';
import type { BudgetsView } from '@/lib/budgets/view';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { AlertsList } from './alerts-list';
import { BudgetDialog } from './budget-dialog';
import { BudgetOverview } from './budget-overview';
import { CapListItem } from './cap-list-item';
import { NoBudget } from './no-budget';
import { OutsideCapsNote } from './outside-caps-note';
import { SuggestionsCard } from './suggestions-card';

/**
 * "Presupuestos": a month's budget against what was spent, by category,
 * with alerts; or, for a month without one, ways to start it.
 */
export function BudgetsScreen({ view }: { view: BudgetsView }) {
  const router = useRouter();
  const { t } = useLocalizer();
  const [pending, startTransition] = React.useTransition();
  const [dialog, setDialog] = React.useState<{
    target: BudgetTarget;
    initial: BudgetForm;
  } | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = React.useState(false);

  const month = view.month;
  const refresh = () => startTransition(() => router.refresh());
  const createTarget: BudgetTarget = {
    mode: 'create',
    month: month.ref,
    currency: view.currency,
  };

  async function copy(templateBudgetId: string) {
    setBusy(true);
    try {
      await copyBudget(templateBudgetId, month.ref, gql);
      toast.success(t('budgets.toasts.copied', { month: month.label }));
      refresh();
    } catch (error) {
      toast.error(budgetErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  }

  function askDelete(id: string) {
    setConfirm({
      title: t('budgets.delete.title', { month: month.label }),
      description: t('budgets.delete.description'),
      confirmLabel: t('budgets.delete.confirm'),
      destructive: true,
      onConfirm: async () => {
        setConfirm(null);
        setBusy(true);
        try {
          await deleteBudget(id, gql);
          toast.success(t('budgets.toasts.deleted', { month: month.label }));
          refresh();
        } catch (error) {
          toast.error(budgetErrorMessage(error, t));
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function onSaved() {
    const created = dialog?.target.mode === 'create';
    setDialog(null);
    toast.success(
      t(created ? 'budgets.toasts.created' : 'budgets.toasts.updated', {
        month: month.label,
      }),
    );
    refresh();
  }

  const budget = view.budget;
  const empty = view.empty;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] leading-9 font-bold text-brand-ink sm:text-[32px] sm:leading-10">
            {t('budgets.title')}
          </h1>
          <p className="text-[15px] text-on-surface-variant">
            {t('budgets.subtitle')}
          </p>
        </div>
        <MonthSwitcher
          as="h2"
          label={month.label}
          prevHref={month.prevHref}
          nextHref={month.nextHref}
        />
      </header>

      <div
        aria-busy={pending || busy}
        className={cn(
          'flex flex-col gap-6 transition-opacity',
          (pending || busy) && 'opacity-60',
        )}
      >
        {budget ? (
          <>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  setDialog({
                    target: { mode: 'edit', id: budget.id },
                    initial: formOfBudget(budget.budget),
                  })
                }
              >
                <Pencil aria-hidden /> {t('budgets.edit')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => askDelete(budget.id)}
              >
                <Trash2 aria-hidden /> {t('budgets.delete.action')}
              </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div className="flex min-w-0 flex-col gap-4">
                <BudgetOverview totals={budget.totals} />
                <AlertsList alerts={budget.alerts} />
                <OutsideCapsNote
                  uncategorized={budget.uncategorized}
                  uncapped={budget.uncapped}
                />
              </div>
              <section
                aria-labelledby="budget-caps"
                className="flex min-w-0 flex-col gap-3"
              >
                <h2
                  id="budget-caps"
                  className="px-1 text-lg font-bold text-on-background"
                >
                  {t('budgets.caps.title')}
                </h2>
                {budget.caps.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {budget.caps.map((item) => (
                      <CapListItem key={item.categoryId} item={item} />
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-card border border-dashed border-on-background/12 p-6 text-center text-sm text-on-surface-variant">
                    {t('budgets.caps.empty')}
                  </p>
                )}
              </section>
            </div>
          </>
        ) : empty ? (
          <>
            <NoBudget
              monthLabel={month.label}
              templateLabel={empty.template?.monthLabel ?? null}
              busy={busy}
              onCreate={() =>
                setDialog({ target: createTarget, initial: emptyBudgetForm() })
              }
              onCopy={() =>
                empty.template && void copy(empty.template.budgetId)
              }
            />
            <SuggestionsCard
              suggestions={empty.suggestions}
              total={empty.suggestionsTotal}
              months={empty.suggestionMonths}
              busy={busy}
              onUse={() =>
                setDialog({
                  target: createTarget,
                  initial: formOfSuggestions(empty.suggestions),
                })
              }
            />
          </>
        ) : null}
      </div>

      {dialog ? (
        <BudgetDialog
          target={dialog.target}
          initial={dialog.initial}
          monthLabel={month.label}
          currency={view.currency}
          categories={view.categories}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
        />
      ) : null}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
