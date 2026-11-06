import * as React from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from 'urql';
import { useTranslations } from 'use-intl';
import { Landmark, Plus } from 'lucide-react-native';

import { ACCOUNTS_QUERY, OVERVIEW_QUERY, RECENT_COUNT, type AccountsResult, type OverviewResult } from '@finnit/core/accounts/request';
import { historyWindow } from '@finnit/core/accounts/balance-history';
import { buildAccounts } from '@finnit/core/accounts/view';
import { indexCategories } from '@finnit/core/finance/categories';
import { startOfDayIso, todayKey } from '@finnit/core/finance/dates';
import { toTransactionRow } from '@finnit/core/finance/transactions';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { Switch } from '@finnit/ui-native/components/ui/switch';
import { Text } from '@finnit/ui-native/components/ui/text';

import { AccountCardStack } from '@/components/accounts/account-card-stack';
import { AddAccountSheet } from '@/components/accounts/add-account-sheet';
import { AccountMovements } from '@/components/accounts/account-movements';
import { Screen } from '@/components/shell/screen';
import { useAuth } from '@/contexts/AuthContext';
import { useView } from '@/lib/graphql/use-view';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { useOnTransactionsChanged } from '@/lib/transactions/events';

/** Cuentas y tarjetas: every account as a card stack and the latest movements of all. */
export function AccountsScreen() {
  const t = useTranslations();
  const router = useRouter();
  const { user } = useAuth();
  const l = useLocalizer();
  const [showArchived, setShowArchived] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const today = todayKey();
  const window = historyWindow(null, today);

  const { view, loading, error, refreshing, refresh } = useView({
    query: ACCOUNTS_QUERY,
    variables: {},
    build: (data: AccountsResult) => ({
      all: data.accounts.edges.map((e) => e.node),
      connections: data.bankConnections,
      archivedCount: data.accounts.edges.filter((e) => e.node.archived).length,
    }),
  });
  const shown = React.useMemo(
    () => (view ? buildAccounts(view.all, view.connections, l, { showArchived }) : []),
    [view, l, showArchived],
  );

  const [overview, refetchOverview] = useQuery<OverviewResult>({
    query: OVERVIEW_QUERY,
    variables: {
      recent: RECENT_COUNT,
      dayStart: null,
      dayEnd: null,
      historyFrom: startOfDayIso(window.from),
      historyTo: startOfDayIso(window.to),
    },
    pause: !view || view.all.length === 0,
  });
  const recent = React.useMemo(() => {
    if (!overview.data) return [];
    const categories = indexCategories(overview.data.categories);
    return overview.data.recent.edges.map((e) => toTransactionRow(e.node, categories, l, { withDate: true }));
  }, [overview.data, l]);

  const reload = () => {
    refresh();
    refetchOverview({ requestPolicy: 'network-only' });
  };
  useOnTransactionsChanged(reload);

  return (
    <Screen
      title={t('accounts.title')}
      actions={<Button size="icon" variant="secondary" icon={Plus} label={t('accounts.add')} onPress={() => setAdding(true)} />}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={reload}
    >
      {adding ? (
        <AddAccountSheet
          existingNames={view?.all.map((a) => a.name) ?? []}
          onClose={() => setAdding(false)}
          onConnectBank={() => {
            setAdding(false);
            router.push('/connect-bank');
          }}
          onCreated={(accountId) => {
            setAdding(false);
            reload();
            router.push({ pathname: '/accounts/[accountId]', params: { accountId } });
          }}
        />
      ) : null}
      {view ? (
        shown.length === 0 && view.archivedCount === 0 ? (
          <EmptyState
            icon={Landmark}
            title={t('accounts.emptyTitle')}
            description={t('accounts.emptyDescription')}
            action={{ label: t('accounts.add'), onPress: () => setAdding(true) }}
          />
        ) : (
          <TwView className="gap-6">
            <AccountCardStack
              accounts={shown}
              holderName={user?.name ?? ''}
              onSelect={(accountId) => router.push({ pathname: '/accounts/[accountId]', params: { accountId } })}
            />
            {view.archivedCount > 0 ? (
              <TwPressable
                accessibilityRole="switch"
                accessibilityState={{ checked: showArchived }}
                onPress={() => setShowArchived((v) => !v)}
                className="flex-row items-center justify-between gap-3 px-1"
              >
                <Text className="text-sm text-on-surface-variant">
                  {t('accounts.showArchived', { count: String(view.archivedCount) })}
                </Text>
                <Switch checked={showArchived} onCheckedChange={setShowArchived} accessibilityLabel={t('accounts.showArchived', { count: String(view.archivedCount) })} />
              </TwPressable>
            ) : null}
            <AccountMovements rows={recent} historyHref="/history" />
          </TwView>
        )
      ) : null}
    </Screen>
  );
}
