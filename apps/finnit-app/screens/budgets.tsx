import * as React from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from 'urql';
import { useTranslations } from 'use-intl';
import { Pencil, Trash2 } from 'lucide-react-native';

import { budgetErrorMessage, copyBudget, deleteBudget, type BudgetTarget } from '@finnit/core/budgets/api';
import { emptyBudgetForm, formOfBudget, formOfSuggestions, type BudgetForm } from '@finnit/core/budgets/form';
import { BUDGET_SUMMARY_QUERY, budgetsData, budgetsQuery, type BudgetsResult } from '@finnit/core/budgets/request';
import type { ApiBudgetSummary } from '@finnit/core/budgets/types';
import { budgetOf, buildBudgetsView } from '@finnit/core/budgets/view';
import { monthOf, parseMonthParam, todayKey } from '@finnit/core/finance/dates';
import { DEFAULT_CURRENCY } from '@finnit/core/finance/money';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { AlertsList, BudgetOverview, CapListItem, NoBudget, OutsideCapsNote, SuggestionsCard } from '@/components/budgets/budget-parts';
import { BudgetSheet } from '@/components/budgets/budget-sheet';
import { MonthSwitcher } from '@/components/finance/month-switcher';
import { Screen } from '@/components/shell/screen';
import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { hrefParam } from '@/lib/nav/href';

/** Presupuestos: a month's budget against what was spent, or ways to start one. */
export function BudgetsScreen() {
  const t = useTranslations();
  const l = useLocalizer();
  const gql = useGql();
  const router = useRouter();
  const params = useLocalSearchParams<{ month?: string }>();
  const current = monthOf(todayKey());
  const selected = parseMonthParam(params.month, current);
  const query = React.useMemo(() => budgetsQuery(selected), [selected.year, selected.month]); // eslint-disable-line react-hooks/exhaustive-deps
  const [result, refetch] = useQuery<BudgetsResult>({ query });
  const hasBudget = result.data ? Boolean(budgetOf(result.data.budgets, selected)) : false;
  const [summaryResult, refetchSummary] = useQuery<{ budgetSummary: ApiBudgetSummary }>({
    query: BUDGET_SUMMARY_QUERY,
    variables: { year: selected.year, month: selected.month },
    pause: !hasBudget,
  });
  const view = React.useMemo(() => {
    if (!result.data || (hasBudget && !summaryResult.data)) return null;
    return buildBudgetsView(
      budgetsData(result.data, selected, summaryResult.data?.budgetSummary ?? null),
      { selected, current, currency: DEFAULT_CURRENCY },
      l,
    );
  }, [result.data, summaryResult.data, hasBudget, selected, current, l]);

  const [dialog, setDialog] = React.useState<{ target: BudgetTarget; initial: BudgetForm } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const refresh = () => {
    refetch({ requestPolicy: 'network-only' });
    if (hasBudget) refetchSummary({ requestPolicy: 'network-only' });
  };
  const month = view?.month;

  async function copy(templateBudgetId: string) {
    if (!month) return;
    setBusy(true);
    try {
      await copyBudget(templateBudgetId, month.ref, gql);
      toast.success(t('budgets.toasts.copied', { month: month.label }));
      refresh();
    } catch (error) {
      toast.error(budgetErrorMessage(error, l.t));
    } finally {
      setBusy(false);
    }
  }

  function askDelete(id: string) {
    if (!month) return;
    Alert.alert(t('budgets.delete.title', { month: month.label }), t('budgets.delete.description'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('budgets.delete.confirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteBudget(id, gql);
            toast.success(t('budgets.toasts.deleted', { month: month.label }));
            refresh();
          } catch (error) {
            toast.error(budgetErrorMessage(error, l.t));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  const goTo = (href: string | null) => href && router.setParams({ month: hrefParam(href, 'month') });
  const budget = view?.budget;
  const empty = view?.empty;

  return (
    <Screen
      title={t('budgets.title')}
      subtitle={t('budgets.subtitle')}
      loading={!view && result.fetching}
      error={!view ? result.error : undefined}
      refreshing={Boolean(view) && result.fetching}
      onRefresh={refresh}
    >
      {view && month ? (
        <TwView className="gap-6" style={{ opacity: busy ? 0.6 : 1 }}>
          <TwView className="items-center">
            <MonthSwitcher label={month.label} onPrevious={() => goTo(month.prevHref)} onNext={month.nextHref ? () => goTo(month.nextHref) : null} />
          </TwView>
          {budget ? (
            <>
              <TwView className="flex-row flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Pencil}
                  label={t('budgets.edit')}
                  disabled={busy}
                  onPress={() => setDialog({ target: { mode: 'edit', id: budget.id }, initial: formOfBudget(budget.budget) })}
                />
                <Button variant="destructive" size="sm" icon={Trash2} label={t('budgets.delete.action')} disabled={busy} onPress={() => askDelete(budget.id)} />
              </TwView>
              <BudgetOverview totals={budget.totals} />
              <AlertsList alerts={budget.alerts} />
              <OutsideCapsNote uncategorized={budget.uncategorized} uncapped={budget.uncapped} />
              <TwView className="gap-3">
                <Text accessibilityRole="header" weight="bold" className="px-1 text-lg">
                  {t('budgets.caps.title')}
                </Text>
                {budget.caps.length > 0 ? (
                  budget.caps.map((item) => <CapListItem key={item.categoryId} item={item} />)
                ) : (
                  <Text className="rounded-card border border-dashed border-on-background-12 p-6 text-center text-sm text-on-surface-variant">
                    {t('budgets.caps.empty')}
                  </Text>
                )}
              </TwView>
            </>
          ) : empty ? (
            <>
              <NoBudget
                monthLabel={month.label}
                templateLabel={empty.template?.monthLabel ?? null}
                busy={busy}
                onCreate={() => setDialog({ target: { mode: 'create', month: month.ref, currency: view.currency }, initial: emptyBudgetForm() })}
                onCopy={() => empty.template && void copy(empty.template.budgetId)}
              />
              <SuggestionsCard
                suggestions={empty.suggestions}
                total={empty.suggestionsTotal}
                months={empty.suggestionMonths}
                busy={busy}
                onUse={() =>
                  setDialog({ target: { mode: 'create', month: month.ref, currency: view.currency }, initial: formOfSuggestions(empty.suggestions) })
                }
              />
            </>
          ) : null}
          {dialog ? (
            <BudgetSheet
              target={dialog.target}
              initial={dialog.initial}
              monthLabel={month.label}
              currency={view.currency}
              categories={view.categories}
              onClose={() => setDialog(null)}
              onSaved={() => {
                const created = dialog.target.mode === 'create';
                setDialog(null);
                toast.success(t(created ? 'budgets.toasts.created' : 'budgets.toasts.updated', { month: month.label }));
                refresh();
              }}
            />
          ) : null}
        </TwView>
      ) : null}
    </Screen>
  );
}
