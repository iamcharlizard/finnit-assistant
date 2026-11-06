import * as React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { ChevronRight, FileText, TriangleAlert } from 'lucide-react-native';

import type { Connection } from '@finnit/core/finance/types';
import { STATEMENTS_PAGE_SIZE } from '@finnit/core/statements/queries';
import { STATEMENTS_QUERY } from '@finnit/core/statements/request';
import type { ApiStatementImport, StatementAccount } from '@finnit/core/statements/types';
import { STATUS_BADGE, accountsById, toStatementListItem, uploadAccountOptions } from '@finnit/core/statements/view';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Badge } from '@finnit/ui-native/components/ui/badge';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { StatementUpload } from '@/components/statements/statement-upload';
import { Screen } from '@/components/shell/screen';
import { useView } from '@/lib/graphql/use-view';

/** Estados de cuenta: upload a card's PDF and follow the ones uploaded. */
export function StatementsScreen() {
  const t = useTranslations('statements');
  const router = useRouter();
  const params = useLocalSearchParams<{ account?: string }>();
  const { view, loading, error, refreshing, refresh } = useView({
    query: STATEMENTS_QUERY,
    variables: { first: STATEMENTS_PAGE_SIZE },
    build: (data: { statementImports: Connection<ApiStatementImport>; accounts: Connection<StatementAccount> }, l) => {
      const accounts = data.accounts.edges.map((e) => e.node);
      const byId = accountsById(accounts);
      return {
        items: data.statementImports.edges.map((e) => toStatementListItem(e.node, byId, l)),
        totalCount: data.statementImports.totalCount,
        cards: uploadAccountOptions(accounts),
      };
    },
  });
  const open = (id: string) => router.push({ pathname: '/statements/[id]', params: { id } });

  return (
    <Screen title={t('title')} subtitle={t('subtitle')} loading={loading} error={error} refreshing={refreshing} onRefresh={refresh}>
      {view ? (
        <TwView className="gap-5">
          <StatementUpload
            cards={view.cards}
            initialAccountId={params.account}
            onUploaded={(id) => {
              toast.success(t('processing'));
              refresh();
              open(id);
            }}
          />
          <Text accessibilityRole="header" weight="bold" className="px-1 text-lg">
            {t('listTitle')}
          </Text>
          {view.items.length === 0 ? (
            <EmptyState icon={FileText} title={t('emptyTitle')} description={t('emptyDescription')} />
          ) : (
            <TwView className="gap-2">
              {view.items.map((item) => (
                <TwPressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.account}, ${item.period}, ${item.statusLabel}`}
                  onPress={() => open(item.id)}
                  className="flex-row items-center gap-3 rounded-2xl bg-surface p-4 active:bg-accent"
                >
                  <TwView className="size-11 items-center justify-center rounded-chip bg-track">
                    <Icon icon={FileText} size={20} color="--on-surface-variant" />
                  </TwView>
                  <TwView className="min-w-0 flex-1 gap-0.5">
                    <TwView className="flex-row flex-wrap items-center gap-2">
                      <Text weight="medium" numberOfLines={1} className="shrink text-sm">
                        {item.account}
                      </Text>
                      <Badge variant={STATUS_BADGE[item.status]} label={item.statusLabel} />
                    </TwView>
                    <Text className="text-xs text-on-surface-variant">
                      {item.period} · {t('uploadedOn', { date: item.uploadedOn })}
                    </Text>
                    {item.balance ? <Text className="text-xs text-on-surface-variant">{t('balance', { amount: item.balance })}</Text> : null}
                    {item.difference ? (
                      <TwView className="flex-row items-center gap-1">
                        <Icon icon={TriangleAlert} size={14} color="--expense" />
                        <Text weight="medium" className="text-xs text-expense">
                          {t('differenceShort', { amount: item.difference })}
                        </Text>
                      </TwView>
                    ) : null}
                  </TwView>
                  <Icon icon={ChevronRight} size={16} color="--on-surface-variant" />
                </TwPressable>
              ))}
            </TwView>
          )}
        </TwView>
      ) : null}
    </Screen>
  );
}
