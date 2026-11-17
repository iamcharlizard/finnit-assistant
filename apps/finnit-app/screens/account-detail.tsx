import * as React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from 'urql';
import { useTranslations } from 'use-intl';

import {
  ACCOUNTS_QUERY,
  ACCOUNT_DETAIL_QUERY,
  CARD_SUMMARY_QUERY,
  RECENT_COUNT,
  type AccountDetailResult,
  type AccountsResult,
  type CardMonthResult,
} from '@finnit/core/accounts/request';
import { historyWindow } from '@finnit/core/accounts/balance-history';
import { buildAccountDetail, buildAccounts } from '@finnit/core/accounts/view';
import { buildCreditUsageView } from '@finnit/core/accounts/credit-usage';
import { CARD_TABS, parseTab, type CardTab } from '@finnit/core/recurring/tabs';
import { indexCategories } from '@finnit/core/finance/categories';
import {
  endOfDayIso,
  lastDayOf,
  monthOf,
  startOfDayIso,
  todayKey,
} from '@finnit/core/finance/dates';
import { toTransactionRow } from '@finnit/core/finance/transactions';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Segmented } from '@finnit/ui-native/components/ui/segmented';
import { Text } from '@finnit/ui-native/components/ui/text';

import { AccountCardVisual } from '@/components/accounts/account-card-visual';
import { AccountMovements } from '@/components/accounts/account-movements';
import { CardMovementsTab } from '@/components/accounts/card-movements-tab';
import { CardPeriodSpending } from '@/components/accounts/card-period-spending';
import { CardPlansTab } from '@/components/accounts/card-plans-tab';
import { CreditUsageCard } from '@/components/accounts/credit-usage-card';
import { AccountStats } from '@/components/accounts/account-stats';
import {
  AccountStatusBadge,
  ExcludedFromTotalBadge,
} from '@/components/accounts/account-status-badge';
import { InTotalSwitch } from '@/components/accounts/in-total-switch';
import { Screen } from '@/components/shell/screen';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { useOnTransactionsChanged } from '@/lib/transactions/events';

/**
 * One account (the web's /accounts/<id>): its card and badges; a credit
 * card in tabs (Resumen, Movimientos by period or month, Pagos a meses,
 * `?tab=`), any other account with its figures and movements.
 */
export function AccountDetailScreen() {
  const { accountId, tab: tabParam } = useLocalSearchParams<{ accountId: string; tab?: string }>();
  const router = useRouter();
  const tab = parseTab(CARD_TABS, tabParam);
  const t = useTranslations('accounts');
  const l = useLocalizer();
  const { user } = useAuth();
  const today = todayKey();
  const month = monthOf(today);
  const window = historyWindow(null, today);

  const [accountsResult, refetchAccounts] = useQuery<AccountsResult>({
    query: ACCOUNTS_QUERY,
  });
  const card = React.useMemo(() => {
    if (!accountsResult.data) return null;
    const all = buildAccounts(
      accountsResult.data.accounts.edges.map((e) => e.node),
      accountsResult.data.bankConnections,
      l,
      { showArchived: true },
    );
    return all.find((a) => a.id === accountId) ?? null;
  }, [accountsResult.data, l, accountId]);

  const [detailResult, refetchDetail] = useQuery<AccountDetailResult>({
    query: ACCOUNT_DETAIL_QUERY,
    variables: {
      accountId,
      recent: RECENT_COUNT,
      from: startOfDayIso(today),
      to: endOfDayIso(lastDayOf(month)),
      dayStart: null,
      dayEnd: null,
      historyFrom: startOfDayIso(window.from),
      historyTo: startOfDayIso(window.to),
    },
  });
  const [summaryResult, refetchSummary] = useQuery<CardMonthResult>({
    query: CARD_SUMMARY_QUERY,
    variables: { accountId, ...month },
    pause: card?.type !== 'credit',
  });

  const detail = React.useMemo(() => {
    if (!card || !detailResult.data) return null;
    const categories = indexCategories(detailResult.data.categories);
    return buildAccountDetail(
      card,
      {
        today,
        recent: detailResult.data.recent.edges.map((e) =>
          toTransactionRow(e.node, categories, l, { withDate: true }),
        ),
        summary: summaryResult.data?.cardMonthSummary ?? null,
        pending: detailResult.data.upcomingPayments,
      },
      l,
    );
  }, [card, detailResult.data, summaryResult.data, today, l]);

  const usage = React.useMemo(
    () => (card ? buildCreditUsageView(summaryResult.data?.creditUsage ?? null, card.currency, l) : null),
    [card, summaryResult.data, l],
  );

  const refreshing =
    (accountsResult.fetching || detailResult.fetching) && Boolean(detail);
  const reload = () => {
    refetchAccounts({ requestPolicy: 'network-only' });
    refetchDetail({ requestPolicy: 'network-only' });
    if (card?.type === 'credit')
      refetchSummary({ requestPolicy: 'network-only' });
  };
  useOnTransactionsChanged(reload);

  const subtitle = card
    ? [
        card.label !== card.name ? card.name : null,
        card.bankName,
        card.last4 ? `•${card.last4}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <Screen
      title={card?.label ?? t('title')}
      subtitle={subtitle || undefined}
      back
      withBottomNav={false}
      loading={!detail && (accountsResult.fetching || detailResult.fetching)}
      error={!detail ? (accountsResult.error ?? detailResult.error) : undefined}
      refreshing={refreshing}
      onRefresh={reload}
    >
      {card && detail ? (
        <TwView className="gap-4">
          <TwView
            className="self-center"
            style={{ width: '100%', maxWidth: 360 }}
          >
            <AccountCardVisual account={card} holderName={user?.name ?? ''} />
          </TwView>
          <TwView className="flex-row items-center gap-2 px-1">
            <AccountStatusBadge
              linked={card.linked}
              archived={card.archived}
              defaultCash={card.defaultCash}
            />
            {card.includedInTotal ? null : <ExcludedFromTotalBadge />}
          </TwView>
          {card.archived ? (
            <Text className="px-1 text-xs text-on-surface-variant">
              {t('archive.archivedNote')}
            </Text>
          ) : null}
          {card.type === 'credit' ? (
            <>
              <Segmented
                accessibilityLabel={t('cardTabs.summary')}
                options={CARD_TABS.map((value) => ({ value, label: t(`cardTabs.${value}`) }))}
                value={tab}
                onValueChange={(next: CardTab) => router.setParams({ tab: next === 'summary' ? undefined : next })}
              />
              {tab === 'summary' ? (
                <>
                  <AccountStats detail={detail} />
                  {usage ? <CreditUsageCard usage={usage} /> : null}
                  <CardPeriodSpending key={`${card.id}:${card.amount}`} accountId={card.id} />
                  {card.archived ? null : <InTotalSwitch key={String(card.includedInTotal)} accountId={card.id} included={card.includedInTotal} />}
                </>
              ) : tab === 'movements' ? (
                <CardMovementsTab
                  accountId={card.id}
                  balanceKey={`${card.id}:${card.amount}:${card.statementDay}:${card.paymentDueDay}`}
                  terms={{
                    statementDay: card.statementDay,
                    paymentDueDay: card.paymentDueDay,
                    interestRateAnnual: card.interestRateAnnual,
                  }}
                />
              ) : (
                <CardPlansTab accountId={card.id} />
              )}
            </>
          ) : (
            <>
              <AccountStats detail={detail} />
              {card.archived ? null : <InTotalSwitch key={String(card.includedInTotal)} accountId={card.id} included={card.includedInTotal} />}
              <AccountMovements rows={detail.recent} historyHref={detail.historyHref} />
            </>
          )}
        </TwView>
      ) : null}
    </Screen>
  );
}
