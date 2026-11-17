import * as React from 'react';
import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';

import {
  CARD_MOVEMENTS_QUERY,
  buildCardMovements,
  cardMovementsVariables,
  type CardMovementsResult,
  type CardMovementsView,
  type CardRange,
} from '@finnit/core/accounts/card-movements';
import { todayKey } from '@finnit/core/finance/dates';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Text } from '@finnit/ui-native/components/ui/text';

import { HistoryRow } from '@/components/history/history-row';
import { requestErrorMessage } from '@finnit/core/graphql/request';
import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { appHref } from '@/lib/nav/app-href';
import { useOnTransactionsChanged } from '@/lib/transactions/events';

const tabular = { fontVariant: ['tabular-nums' as const] };

/** A card's movements in a range (a cycle or a month), by day, with what was spent and paid in it. */
export function CardRangeMovements({ accountId, range }: { accountId: string; range: CardRange }) {
  const t = useTranslations('accounts.cardMovements');
  const l = useLocalizer();
  const gql = useGql();
  const router = useRouter();
  const [view, setView] = React.useState<CardMovementsView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);
  useOnTransactionsChanged(() => setVersion((n) => n + 1));

  React.useEffect(() => {
    let live = true;
    gql<CardMovementsResult>(CARD_MOVEMENTS_QUERY, cardMovementsVariables(accountId, range))
      .then((data) => {
        if (!live) return;
        setError(null);
        setView(buildCardMovements(data, { accountId, range, today: todayKey() }, l));
      })
      .catch((e: unknown) => live && setError(requestErrorMessage(e, l.t)));
    return () => {
      live = false;
    };
  }, [accountId, range.from, range.to, version, gql, l]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Text className="text-sm text-expense">{error}</Text>;
  if (!view) return <Text className="text-sm text-on-surface-variant">{t('loading')}</Text>;

  const figure = (label: string, value: string, className: string) => (
    <TwView className="flex-1">
      <Text className="text-xs text-on-surface-variant">{label}</Text>
      <Text weight="bold" className={className} style={tabular}>
        {value}
      </Text>
    </TwView>
  );
  return (
    <TwView className="gap-4">
      <TwView className="flex-row gap-3 rounded-[20px] bg-surface p-4">
        {figure(t('count'), String(view.count), 'text-sm text-on-background')}
        {figure(t('spent'), view.spent, 'text-sm text-expense')}
        {figure(t('paidIn'), view.paidIn, 'text-sm text-income')}
      </TwView>
      {view.groups.length === 0 ? (
        <Text className="text-sm text-on-surface-variant">{t('empty')}</Text>
      ) : (
        view.groups.map((group) => (
          <TwView key={group.day} className="gap-2">
            <Text weight="medium" className="px-1 text-xs text-on-surface-variant">
              {group.heading}
            </Text>
            {group.rows.map((row) => (
              <HistoryRow key={row.id} row={row} />
            ))}
          </TwView>
        ))
      )}
      <Button variant="ghost" size="sm" className="self-start" label={view.truncated ? t('seeAll') : t('openHistory')} onPress={() => router.navigate(appHref(view.historyHref))} />
    </TwView>
  );
}
