import * as React from 'react';
import { useQuery } from 'urql';
import { useTranslations } from 'use-intl';
import { CopyCheck, Merge, X } from 'lucide-react-native';

import {
  DUPLICATE_SUGGESTIONS_QUERY,
  resolveDuplicate,
  type ApiDuplicateSuggestion,
  type DuplicateSuggestionsResult,
} from '@finnit/core/duplicates/request';
import { toMergeSide } from '@finnit/core/duplicates/view';
import { transactionErrorMessage } from '@finnit/core/transaction-detail/api';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { MergeDuplicateSheet } from '@/components/duplicates/merge-duplicate-sheet';
import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import {
  emitTransactionsChanged,
  useOnTransactionsChanged,
} from '@/lib/transactions/events';

/**
 * "Posibles duplicados" at the top of Clasificar (the web's panel): pairs of
 * movements that look like the same money recorded twice, with "Fusionar"
 * and "No es duplicado".
 */
export function DuplicateSuggestionsPanel() {
  const t = useTranslations('duplicates');
  const l = useLocalizer();
  const gql = useGql();
  const [result, refetch] = useQuery<DuplicateSuggestionsResult>({
    query: DUPLICATE_SUGGESTIONS_QUERY,
    variables: { first: 10 },
  });
  const [merging, setMerging] = React.useState<ApiDuplicateSuggestion | null>(
    null,
  );
  const [busy, setBusy] = React.useState<string | null>(null);
  const reload = React.useCallback(
    () => refetch({ requestPolicy: 'network-only' }),
    [refetch],
  );
  useOnTransactionsChanged(reload);

  const rows = result.data?.duplicateSuggestions.edges.map((e) => e.node) ?? [];
  if (rows.length === 0) return null;

  function dismiss(id: string) {
    setBusy(id);
    resolveDuplicate({ id, action: 'dismiss' }, gql)
      .then(() => {
        toast.info(t('toasts.dismissed'));
        reload();
      })
      .catch((e: unknown) => toast.error(transactionErrorMessage(e, l.t)))
      .finally(() => setBusy(null));
  }

  return (
    <TwView className="gap-3 rounded-3xl border border-glass-border bg-surface p-4">
      <TwView className="gap-1">
        <TwView className="flex-row items-center gap-2">
          <Icon icon={CopyCheck} size={16} />
          <Text accessibilityRole="header" weight="bold" className="text-base">
            {t('title')} ·{' '}
            {String(
              result.data?.duplicateSuggestions.totalCount ?? rows.length,
            )}
          </Text>
        </TwView>
        <Text className="text-sm text-on-surface-variant">
          {t('description')}
        </Text>
      </TwView>
      {rows.map((s) => {
        const keep = toMergeSide(s.keep, l);
        const drop = toMergeSide(s.drop, l);
        return (
          <TwView key={s.id} className="gap-3 rounded-2xl bg-track p-3">
            {[drop, keep].map((side) => (
              <TwView key={side.id}>
                <Text weight="medium" numberOfLines={1} className="text-sm">
                  {side.title}
                </Text>
                <Text className="text-xs text-on-surface-variant">
                  {[side.amount, side.date, side.origin].join(' · ')}
                </Text>
              </TwView>
            ))}
            <TwView className="flex-row flex-wrap gap-2">
              <Button
                size="sm"
                icon={Merge}
                label={t('merge')}
                disabled={busy === s.id}
                onPress={() => setMerging(s)}
              />
              <Button
                size="sm"
                variant="ghost"
                icon={X}
                label={t('notDuplicate')}
                disabled={busy === s.id}
                onPress={() => dismiss(s.id)}
              />
            </TwView>
          </TwView>
        );
      })}
      {merging ? (
        <MergeDuplicateSheet
          transaction={merging.drop}
          other={merging.keep}
          onClose={() => setMerging(null)}
          onMerged={() => {
            setMerging(null);
            toast.success(t('toasts.merged'));
            emitTransactionsChanged(null);
          }}
        />
      ) : null}
    </TwView>
  );
}
