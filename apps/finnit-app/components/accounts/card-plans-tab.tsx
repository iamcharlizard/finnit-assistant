import * as React from 'react';
import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { CalendarClock, Plus } from 'lucide-react-native';

import { CARD_PLANS_QUERY, cardPlansOf, cardPlansVariables, type CardPlansResult } from '@finnit/core/debts/card-plans';
import { buildDebtsView } from '@finnit/core/debts/view';
import { todayKey } from '@finnit/core/finance/dates';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { Text } from '@finnit/ui-native/components/ui/text';

import { DebtCard } from '@/components/debts/debt-card';
import { requestErrorMessage } from '@finnit/core/graphql/request';
import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { useOnTransactionsChanged } from '@/lib/transactions/events';

/** A card's "Pagos a meses": its purchases in installments as in Deudas, and a new one with the card chosen. */
export function CardPlansTab({ accountId }: { accountId: string }) {
  const t = useTranslations('accounts.cardPlans');
  const l = useLocalizer();
  const gql = useGql();
  const router = useRouter();
  const [data, setData] = React.useState<CardPlansResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);
  useOnTransactionsChanged(() => setVersion((n) => n + 1));

  React.useEffect(() => {
    let live = true;
    gql<CardPlansResult>(CARD_PLANS_QUERY, cardPlansVariables())
      .then((result) => live && setData(result))
      .catch((e: unknown) => live && setError(requestErrorMessage(e, l.t)));
    return () => {
      live = false;
    };
  }, [gql, l, version]);

  if (error) return <Text className="text-sm text-expense">{error}</Text>;
  if (!data) return <Text className="text-sm text-on-surface-variant">{t('loading')}</Text>;

  const accounts = data.accounts.edges.map((e) => e.node);
  const plans = cardPlansOf(
    data.debts.edges.map((e) => e.node),
    accountId,
  );
  const view = buildDebtsView({ debts: plans, accounts }, { today: todayKey() }, l);
  const create = () => router.push({ pathname: '/new-debt', params: { kind: 'card_installments', account: accountId } });

  return (
    <TwView className="gap-4">
      <TwView className="flex-row items-center justify-between gap-3">
        <Text className="px-1 text-sm text-on-surface-variant">{t('count', { count: plans.length })}</Text>
        <Button variant="secondary" size="sm" icon={Plus} label={t('new')} onPress={create} />
      </TwView>
      {plans.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        view.debts.map((item) => (
          <DebtCard key={item.id} item={item} onOpen={() => router.push({ pathname: '/planning/debts/[id]', params: { id: item.id } })} />
        ))
      )}
    </TwView>
  );
}
