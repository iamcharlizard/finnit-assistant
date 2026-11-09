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
import { UPCOMING_DAYS, buildDashboardView, maskDashboardView } from '@finnit/core/dashboard/view';
import { monthOf, todayKey } from '@finnit/core/finance/dates';
import { TwView } from '@finnit/ui-native/lib/tw';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { SectionHeading } from '@finnit/ui-native/components/ui/section-heading';

import { BudgetDashboardCard } from '@/components/budgets/budget-dashboard-card';
import { BalanceSummary } from '@/components/dashboard/balance-summary';
import { DashboardAccounts } from '@/components/dashboard/dashboard-accounts';
import { DashboardDebts } from '@/components/dashboard/dashboard-debts';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { DashboardWelcome } from '@/components/dashboard/dashboard-welcome';
import { PaymentRow } from '@/components/finance/payment-row';
import { TextLink } from '@/components/finance/text-link';
import { Screen } from '@/components/shell/screen';
import { useAuth } from '@/contexts/AuthContext';
import { useView } from '@/lib/graphql/use-view';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { useAmountsVisibility } from '@/lib/privacy/amounts-visibility';

/**
 * Home: the available balance (tap: Cuentas; the eye hides every amount),
 * the analytics in a sideways row, the accounts, budget, upcoming payments
 * and debts.
 */
export function DashboardScreen() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const router = useRouter();
  const { user } = useAuth();
  const l = useLocalizer();
  const today = todayKey();
  const month = monthOf(today);
  const firstName = user?.name.split(' ')[0] ?? '';

  const { hidden } = useAmountsVisibility();
  const { view: fullView, loading, error, refreshing, refresh } = useView({
    query: DASHBOARD_QUERY,
    variables: dashboardVariables(today),
    build: (data: DashboardResult, loc) => buildDashboardView(dashboardData(data), { today, month }, loc),
  });
  const view = fullView && hidden ? maskDashboardView(fullView) : fullView;
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
        <DashboardWelcome />
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
          <DashboardStats stats={view.stats} />
          {view.accounts.length > 0 ? <DashboardAccounts accounts={view.accounts} count={view.accountCount} /> : null}
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
          {view.debts ? <DashboardDebts insights={view.debts.insights} today={view.debts.today} hidden={hidden} /> : null}
        </TwView>
      ) : null}
    </Screen>
  );
}
