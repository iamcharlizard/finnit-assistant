import * as React from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { Gauge, Landmark, Percent, Wallet } from 'lucide-react-native';

import { buildDebtInsightsView } from '@finnit/core/debts/insights-view';
import { DEBTS_PAGE, DEBTS_QUERY, type DebtsResult } from '@finnit/core/debts/request';
import { buildDebtsView, type DebtItem } from '@finnit/core/debts/view';
import { todayKey } from '@finnit/core/finance/dates';
import { TwView } from '@finnit/ui-native/lib/tw';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { Segmented } from '@finnit/ui-native/components/ui/segmented';

import { BalanceProjectionChart } from '@/components/debts/insights/balance-projection-chart';
import { DebtTypeBars } from '@/components/debts/insights/debt-type-bars';
import { DebtCard } from '@/components/debts/debt-card';
import { SummaryCard } from '@/components/recurring/summary-card';
import { Screen } from '@/components/shell/screen';
import { useView } from '@/lib/graphql/use-view';
import { useOnTransactionsChanged } from '@/lib/transactions/events';

type Tab = 'summary' | 'loans' | 'other';

/** Deudas: totals and charts, loans, and cards / other debts (the web's three tabs). */
export function DebtsScreen() {
  const t = useTranslations('debts');
  const router = useRouter();
  const { width } = useWindowDimensions();
  const today = todayKey();
  const [tab, setTab] = React.useState<Tab>('summary');
  const { view, loading, error, refreshing, refresh } = useView({
    query: DEBTS_QUERY,
    variables: { first: DEBTS_PAGE },
    build: (data: DebtsResult, l) => {
      const debts = data.debts.edges.map((e) => e.node);
      const accounts = data.accounts.edges.map((e) => e.node);
      return {
        all: buildDebtsView({ debts, accounts }, { today }, l),
        insights: buildDebtInsightsView(data.debtInsights, { today, includeMsi: false }, l),
      };
    },
  });
  useOnTransactionsChanged(refresh);
  const cardWidth = Math.round(width * 0.72);
  const open = (item: DebtItem) => router.push({ pathname: '/planning/debts/[id]', params: { id: item.id } });
  const loans = view?.all.debts.filter((d) => d.kind === 'loan') ?? [];
  const others = view?.all.debts.filter((d) => d.kind !== 'loan') ?? [];

  return (
    <Screen title={t('title')} subtitle={t('subtitle')} loading={loading} error={error} refreshing={refreshing} onRefresh={refresh}>
      {view ? (
        view.all.debts.length === 0 ? (
          <EmptyState icon={Landmark} title={t('empty.title')} description={t('empty.description')} />
        ) : (
          <TwView className="gap-5">
            <Segmented
              accessibilityLabel={t('title')}
              options={[
                { value: 'summary', label: t('tabs.summary') },
                { value: 'loans', label: t('tabs.loans', { count: loans.length }) },
                { value: 'other', label: t('tabs.other', { count: others.length }) },
              ]}
              value={tab}
              onValueChange={(next) => setTab(next as Tab)}
            />
            {tab === 'summary' ? (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }} snapToInterval={cardWidth + 12} decelerationRate="fast">
                  <SummaryCard
                    width={cardWidth}
                    icon={Wallet}
                    accent="#ba1a1a"
                    label={t('summary.owed')}
                    amount={view.all.totals.owed}
                    detail={t('summary.owedDetail', { count: view.all.totals.active, paidOff: view.all.totals.paidOff })}
                  />
                  <SummaryCard width={cardWidth} icon={Gauge} accent="#00696e" label={t('summary.minimums')} amount={view.all.totals.minimums} detail={t('summary.minimumsDetail')} />
                  <SummaryCard
                    width={cardWidth}
                    icon={Percent}
                    accent="#6c72cb"
                    label={t('summary.rate')}
                    amount={view.all.totals.weightedRate ?? '—'}
                    detail={view.all.totals.weightedRate ? t('summary.rateMissing', { count: view.all.totals.withoutRate }) : t('summary.rateUnknown')}
                  />
                </ScrollView>
                <DebtTypeBars bars={view.insights.types} />
                <BalanceProjectionChart points={view.insights.projection} paidOffLabel={view.insights.paidOffLabel} />
              </>
            ) : (
              <TwView className="gap-3">
                {(tab === 'loans' ? loans : others).length === 0 ? (
                  <EmptyState icon={Landmark} title={tab === 'loans' ? t('empty.title') : t('otherEmpty.title')} />
                ) : (
                  (tab === 'loans' ? loans : others).map((item) => <DebtCard key={item.id} item={item} onOpen={() => open(item)} />)
                )}
              </TwView>
            )}
          </TwView>
        )
      ) : null}
    </Screen>
  );
}
