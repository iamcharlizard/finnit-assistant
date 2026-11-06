import * as React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';

import { todayKey } from '@finnit/core/finance/dates';
import type { Connection } from '@finnit/core/finance/types';
import { STATEMENT_REVIEW_QUERY } from '@finnit/core/statements/request';
import type { ApiStatementDetail, StatementAccount, StatementCategory } from '@finnit/core/statements/types';
import { STATUS_BADGE, accountsById, isWorking, toStatementDetailView } from '@finnit/core/statements/view';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Badge } from '@finnit/ui-native/components/ui/badge';
import { Card } from '@finnit/ui-native/components/ui/card';
import { Text } from '@finnit/ui-native/components/ui/text';

import { Screen } from '@/components/shell/screen';
import { useView } from '@/lib/graphql/use-view';

/** One statement: its facts, whether it adds up, and the lines read from it. */
export function StatementReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations('statements');
  const router = useRouter();
  const today = todayKey();
  const { view, loading, error, refreshing, refresh } = useView({
    query: STATEMENT_REVIEW_QUERY,
    variables: { id },
    build: (data: { statementImport: ApiStatementDetail; accounts: Connection<StatementAccount>; categories: StatementCategory[] }, l) =>
      toStatementDetailView(
        data.statementImport,
        accountsById(data.accounts.edges.map((e) => e.node)),
        new Map(data.categories.map((c) => [c.id, c])),
        today,
        l,
      ),
  });
  // While the server reads it, ask again every few seconds.
  const working = view ? isWorking(view.status) : false;
  React.useEffect(() => {
    if (!working) return;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [working, refresh]);

  return (
    <Screen title={view?.account ?? t('title')} subtitle={view?.period} back withBottomNav={false} loading={loading} error={error} refreshing={refreshing} onRefresh={refresh}>
      {view ? (
        <TwView className="gap-4">
          <TwView className="flex-row items-center gap-2 px-1">
            <Badge variant={STATUS_BADGE[view.status]} label={view.statusLabel} />
            {view.parser ? <Text className="text-xs text-on-surface-variant">{view.parser}</Text> : null}
          </TwView>
          {working ? <Text className="px-1 text-sm text-on-surface-variant">{t('processingHint')}</Text> : null}
          {view.errorMessage ? <Text className="px-1 text-sm text-expense">{view.errorMessage}</Text> : null}
          {view.facts.length > 0 ? (
            <Card className="gap-1">
              <Text weight="bold" className="mb-1 text-sm">
                {t('factsTitle')}
              </Text>
              {view.facts.map((fact, i) => (
                <TwView key={fact.label} className={cn('flex-row justify-between gap-3 py-1.5', i > 0 && 'border-t border-glass-border')}>
                  <Text className="text-sm text-on-surface-variant">{fact.label}</Text>
                  <Text weight="medium" className="text-sm">
                    {fact.value}
                  </Text>
                </TwView>
              ))}
            </Card>
          ) : null}
          {view.check.statement ? (
            <Card className="gap-2">
              <Text weight="bold" className="text-sm">
                {t('check.title')}
              </Text>
              <Text className={cn('text-sm', view.check.mismatch ? 'text-expense' : 'text-on-surface-variant')}>
                {view.check.mismatch ? t('check.mismatch') : t('check.ok')}
              </Text>
            </Card>
          ) : null}
          <Card className="gap-1">
            <Text weight="bold" className="mb-1 text-sm">
              {t('lines.title', { count: view.lines.length })}
            </Text>
            {view.lines.length === 0 ? (
              <Text className="text-sm text-on-surface-variant">{t('lines.empty')}</Text>
            ) : (
              view.lines.map((line, i) => (
                <TwPressable
                  key={line.id}
                  disabled={!line.matchedTransactionId}
                  onPress={() => line.matchedTransactionId && router.push({ pathname: '/transaction/[id]', params: { id: line.matchedTransactionId } })}
                  className={cn('flex-row items-center gap-3 py-2', i > 0 && 'border-t border-glass-border')}
                >
                  <TwView className="min-w-0 flex-1">
                    <Text numberOfLines={2} className="text-sm">
                      {line.description}
                    </Text>
                    <Text className="text-xs text-on-surface-variant">
                      {line.date} · {line.kindLabel}
                      {line.categoryLabel ? ` · ${line.categoryLabel}` : ''}
                    </Text>
                  </TwView>
                  <TwView className="items-end gap-1">
                    <Text weight="bold" className={cn('text-sm', line.variant === 'income' ? 'text-income' : 'text-on-background')}>
                      {line.amount}
                    </Text>
                    <Text className="text-[11px] text-on-surface-variant">{line.statusLabel}</Text>
                  </TwView>
                </TwPressable>
              ))
            )}
          </Card>
        </TwView>
      ) : null}
    </Screen>
  );
}
