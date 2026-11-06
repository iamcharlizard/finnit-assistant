import { useRouter } from 'expo-router';
import { useQuery } from 'urql';
import { useTranslations } from 'use-intl';
import { CalendarCheck, Landmark } from 'lucide-react-native';

import { buildBudgetCard, budgetOf } from '@finnit/core/budgets/view';
import {
  DASHBOARD_BUDGET_QUERY,
  DASHBOARD_QUERY,
  dashboardData,
  dashboardVariables,
  type DashboardBudgetResult,
  type DashboardResult,
} from '@finnit/core/dashboard/request';
import { UPCOMING_DAYS, buildDashboardView } from '@finnit/core/dashboard/view';
import { monthOf, todayKey } from '@finnit/core/finance/dates';
import { TwView } from '@finnit/ui-native/lib/tw';
import { StatCard } from '@finnit/ui-native/components/finance/stat-card';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { SectionHeading } from '@finnit/ui-native/components/ui/section-heading';

import { BudgetDashboardCard } from '@/components/budgets/budget-dashboard-card';
import { BalanceSummary } from '@/components/dashboard/balance-summary';
import { DashboardDebts } from '@/components/dashboard/dashboard-debts';
import { DashboardWelcome } from '@/components/dashboard/dashboard-welcome';
import { PaymentRow } from '@/components/finance/payment-row';
import { TextLink } from '@/components/finance/text-link';
import { Screen } from '@/components/shell/screen';
import { useAuth } from '@/contexts/AuthContext';
import { useView } from '@/lib/graphql/use-view';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/** Home: balance, the month's income and expenses, budget, upcoming payments and debts. */
export function DashboardScreen() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const router = useRouter();
  const { user } = useAuth();
  const l = useLocalizer();
  const today = todayKey();
  const month = monthOf(today);
  const firstName = user?.name.split(' ')[0] ?? '';

  const { view, loading, error, refreshing, refresh } = useView({
    query: DASHBOARD_QUERY,
    variables: dashboardVariables(today),
    build: (data: DashboardResult, loc) => buildDashboardView(dashboardData(data), { today, month }, loc),
  });
  const [budgetResult, refetchBudget] = useQuery<DashboardBudgetResult>({
    query: DASHBOARD_BUDGET_QUERY,
    variables: { ...month },
  });
  const budget = budgetResult.data ? budgetOf(budgetResult.data.budgets, month) : null;
  const budgetCard =
    budget && budgetResult.data ? buildBudgetCard(budget, budgetResult.data.monthlyReport.totalExpenses, l) : null;

  const onRefresh = () => {
    refresh();
    refetchBudget({ requestPolicy: 'network-only' });
  };

  if (view?.isEmpty) {
    return (
      <Screen title={t('greeting', { name: firstName })} refreshing={refreshing} onRefresh={onRefresh}>
        <DashboardWelcome firstName={firstName} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t('greeting', { name: firstName })}
      subtitle={view?.todayLabel}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {view ? (
        <TwView className="gap-4">
          {view.balance ? (
            <BalanceSummary balance={view.balance} />
          ) : (
            <EmptyState
              icon={Landmark}
              title={t('noAccountsTitle')}
              description={t('noAccountsDescription')}
              action={{ label: tc('connectBank'), onPress: () => router.push('/connect-bank') }}
            />
          )}
          <TwView className="gap-3">
            <StatCard variant="income" label={t('incomeOf', { month: view.month.label })} amount={view.month.income} />
            <StatCard variant="expense" label={t('expensesOf', { month: view.month.label })} amount={view.month.expenses} />
          </TwView>
          {budgetCard ? <BudgetDashboardCard card={budgetCard} /> : null}
          <TwView>
            <SectionHeading title={t('upcoming')} action={<TextLink href="/recurring" label={t('calendarLink')} />} />
            {view.upcoming.length > 0 ? (
              <TwView className="gap-2">
                {view.upcoming.map((row) => (
                  <PaymentRow key={row.id} row={row} />
                ))}
              </TwView>
            ) : (
              <EmptyState
                icon={CalendarCheck}
                title={t('noUpcomingTitle')}
                description={t('noUpcomingDescription', { days: String(UPCOMING_DAYS) })}
              />
            )}
          </TwView>
          {view.debts ? <DashboardDebts insights={view.debts.insights} today={view.debts.today} /> : null}
        </TwView>
      ) : null}
    </Screen>
  );
}
