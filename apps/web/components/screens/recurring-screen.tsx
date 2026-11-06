'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Repeat, Sparkles } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@finnit/ui/components/ui/tabs';
import { toast } from '@finnit/ui/components/ui/toaster';

import {
  ConfirmDialog,
  type ConfirmRequest,
} from '@/components/admin/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import {
  ExpenseDialog,
  type ExpenseDialogSubject,
} from '@/components/recurring/expense-dialog';
import { LoanDialog } from '@/components/debts/loan-dialog';
import { ExpenseList } from '@/components/recurring/expense-list';
import { SuggestionsSection } from '@/components/recurring/suggestions-section';
import { TabCount } from '@/components/recurring/tab-count';
import { useSessionUser } from '@/components/session-provider';
import { useRecurringSuggestions } from '@/hooks/use-recurring-suggestions';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import {
  deleteRecurring,
  dismissSuggestion,
  recurringErrorMessage,
  setRecurringActive,
} from '@finnit/core/recurring/api';
import {
  withExpenseFilters,
  type ExpenseFilters,
} from '@finnit/core/recurring/filters';
import {
  parseTabParam,
  withTabParam,
  type RecurringTab,
} from '@finnit/core/recurring/tabs';
import type { ApiRecurringSuggestion } from '@finnit/core/recurring/types';
import { DEBTS_PATH } from '@finnit/core/debts/view';
import type {
  ExpenseItem,
  RecurringScreenView,
} from '@finnit/core/recurring/view';

const TAB = 'flex-1 px-2 sm:flex-none sm:px-4';
const TAB_ICON = 'hidden sm:block';

/**
 * "Pagos recurrentes": the user's recurring expenses (with a filter bar)
 * and the ones detected from their movements, one tab at a time. Their
 * dates and totals live in the payments calendar (/calendar).
 */
export function RecurringScreen({
  data,
  initialTab,
  initialFilters,
}: {
  data: RecurringScreenView;
  initialTab: RecurringTab;
  initialFilters: ExpenseFilters;
}) {
  const router = useRouter();
  const l = useLocalizer();
  const { t } = l;
  const [, startTransition] = React.useTransition();
  const [dialog, setDialog] = React.useState<ExpenseDialogSubject | null>(null);
  // A suggestion being saved as a loan.
  const [loanFor, setLoanFor] = React.useState<ApiRecurringSuggestion | null>(
    null,
  );
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const suggestions = useRecurringSuggestions(useSessionUser().id);
  const [tab, setTab] = React.useState(initialTab);
  const [filters, setFilters] = React.useState(initialFilters);

  // The tab lives in the URL (no navigation) so a reload or refresh keeps it.
  function changeTab(value: string) {
    const next = parseTabParam(value);
    setTab(next);
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${withTabParam(window.location.search, next)}`,
    );
  }

  // The filters too: a shared or reloaded link shows the same list.
  function changeFilters(next: ExpenseFilters) {
    setFilters(next);
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${withExpenseFilters(window.location.search, next)}`,
    );
  }

  const refresh = () => startTransition(() => router.refresh());
  const fail = (error: unknown) => toast.error(recurringErrorMessage(error, t));

  function editExpense(id: string) {
    const item = data.expenses.find((e) => e.id === id);
    if (item) setDialog({ mode: 'edit', expense: item.expense });
  }

  async function toggleActive(item: ExpenseItem) {
    setBusyKey(item.id);
    try {
      await setRecurringActive(item.id, !item.active, gql);
      toast.success(
        t(
          item.active ? 'recurring.toasts.paused' : 'recurring.toasts.resumed',
          {
            name: item.name,
          },
        ),
      );
      refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusyKey(null);
    }
  }

  function askDelete(item: ExpenseItem) {
    setConfirm({
      title: t('recurring.delete.title', { name: item.name }),
      description: t('recurring.delete.description'),
      confirmLabel: t('recurring.delete.confirm'),
      destructive: true,
      onConfirm: async () => {
        setConfirm(null);
        setBusyKey(item.id);
        try {
          await deleteRecurring(item.id, gql);
          toast.success(t('recurring.toasts.deleted', { name: item.name }));
          refresh();
        } catch (error) {
          fail(error);
        } finally {
          setBusyKey(null);
        }
      },
    });
  }

  async function dismiss(suggestion: ApiRecurringSuggestion, index: number) {
    // Off the list right away; back in place if the API refuses.
    suggestions.remove(suggestion.fingerprint);
    try {
      await dismissSuggestion(suggestion.fingerprint, gql);
      toast.success(
        t('recurring.toasts.dismissed', { name: suggestion.suggestedName }),
      );
    } catch (error) {
      suggestions.restore(suggestion, index);
      fail(error);
    }
  }

  function onLoanSaved(id: string, name: string) {
    const suggestion = loanFor;
    setLoanFor(null);
    if (suggestion) suggestions.remove(suggestion.fingerprint);
    toast.success(t('recurring.toasts.acceptedAsLoan', { name }));
    router.push(`${DEBTS_PATH}/${id}`);
  }

  function onSaved(changed: boolean, name: string) {
    const subject = dialog;
    setDialog(null);
    if (!changed) {
      toast(t('recurring.toasts.noChanges'));
      return;
    }
    if (subject?.mode === 'suggestion') {
      suggestions.remove(subject.suggestion.fingerprint);
      toast.success(t('recurring.toasts.accepted', { name }));
    } else {
      toast.success(
        t(
          subject?.mode === 'edit'
            ? 'recurring.toasts.updated'
            : 'recurring.toasts.created',
          { name },
        ),
      );
    }
    refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t('recurring.title')}
        subtitle={t('recurring.subtitle')}
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDialog({ mode: 'create' })}
          >
            <Plus aria-hidden /> {t('recurring.new')}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={changeTab} className="gap-5">
        <TabsList
          aria-label={t('recurring.tabs.label')}
          className="w-full sm:w-fit"
        >
          <TabsTrigger value="list" className={TAB}>
            <Repeat aria-hidden className={TAB_ICON} />{' '}
            {t('recurring.tabs.list')}
            <TabCount count={data.expenses.length} />
          </TabsTrigger>
          <TabsTrigger value="suggestions" className={TAB}>
            <Sparkles aria-hidden className={TAB_ICON} />{' '}
            {t('recurring.tabs.suggestions')}
            {suggestions.state.status === 'ready' ? (
              <TabCount count={suggestions.state.items.length} highlight />
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <ExpenseList
            expenses={data.expenses}
            filters={filters}
            onFiltersChange={changeFilters}
            busyId={busyKey}
            onCreate={() => setDialog({ mode: 'create' })}
            onEdit={(item) => editExpense(item.id)}
            onToggleActive={toggleActive}
            onDelete={askDelete}
          />
        </TabsContent>

        <TabsContent value="suggestions">
          <SuggestionsSection
            state={suggestions.state}
            today={data.today}
            onRetry={() => void suggestions.reload()}
            onAdd={(suggestion) =>
              setDialog({ mode: 'suggestion', suggestion })
            }
            onLoan={setLoanFor}
            onDismiss={dismiss}
          />
        </TabsContent>
      </Tabs>

      {dialog ? (
        <ExpenseDialog
          subject={dialog}
          accounts={data.accounts}
          categories={data.categories}
          defaultCurrency={data.currency}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
          onSwitchToLoan={
            dialog.mode === 'suggestion'
              ? () => {
                  setLoanFor(dialog.suggestion);
                  setDialog(null);
                }
              : undefined
          }
        />
      ) : null}
      {loanFor ? (
        <LoanDialog
          fingerprint={loanFor.fingerprint}
          accounts={data.accounts}
          categories={data.categories}
          today={data.today}
          onClose={() => setLoanFor(null)}
          onSaved={onLoanSaved}
        />
      ) : null}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
