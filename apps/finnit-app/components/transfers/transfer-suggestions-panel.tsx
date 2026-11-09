import * as React from 'react';
import { useTranslations } from 'use-intl';
import { ArrowLeftRight, UserRound, X } from 'lucide-react-native';

import { requestErrorMessage } from '@finnit/core/graphql/request';
import {
  RESOLVE_TRANSFER_SUGGESTION_MUTATION,
  type ResolveInput,
  type TransferSuggestionView,
} from '@finnit/core/transfers/suggestions';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { emitTransactionsChanged } from '@/lib/transactions/events';

/**
 * "Posibles transferencias" at the top of Movimientos (the web's panel):
 * bank movements that look like money moved between the user's accounts.
 * "A mi cuenta" pairs it with the account it probably went to (when there
 * is one); "A otra persona" keeps it as an expense or income; "Ignorar".
 */
export function TransferSuggestionsPanel({
  suggestions,
  total,
}: {
  suggestions: TransferSuggestionView[];
  total: number;
}) {
  const t = useTranslations('transfers.suggestions');
  const l = useLocalizer();
  const gql = useGql();
  const [busy, setBusy] = React.useState<string | null>(null);
  if (suggestions.length === 0) return null;

  function resolve(
    s: TransferSuggestionView,
    input: ResolveInput,
    done: string,
  ) {
    setBusy(s.id);
    gql(RESOLVE_TRANSFER_SUGGESTION_MUTATION, { id: s.id, input })
      .then(() => {
        toast.success(done);
        emitTransactionsChanged(null);
      })
      .catch((e: unknown) => toast.error(requestErrorMessage(e, l.t)))
      .finally(() => setBusy(null));
  }

  return (
    <TwView className="gap-3 rounded-3xl border border-glass-border bg-surface p-4">
      <TwView className="gap-1">
        <TwView className="flex-row items-center gap-2">
          <Icon icon={ArrowLeftRight} size={16} />
          <Text accessibilityRole="header" weight="bold" className="text-base">
            {t('title')} · {String(total)}
          </Text>
        </TwView>
        <Text className="text-sm text-on-surface-variant">
          {t('description')}
        </Text>
      </TwView>
      {suggestions.map((s) => {
        const out = s.variant === 'expense';
        return (
          <TwView key={s.id} className="gap-2 rounded-2xl bg-track p-3">
            <TwView className="flex-row items-start gap-2">
              <TwView className="flex-1">
                <Text weight="medium" numberOfLines={1} className="text-sm">
                  {s.title}
                </Text>
                <Text className="text-xs text-on-surface-variant">
                  {s.meta}
                </Text>
              </TwView>
              <Text
                weight="bold"
                className={cn('text-sm', out ? 'text-expense' : 'text-income')}
              >
                {s.amount}
              </Text>
            </TwView>
            <Text className="text-xs text-on-surface-variant">{s.hint}</Text>
            <TwView className="flex-row flex-wrap gap-2">
              {s.accountId ? (
                <Button
                  size="sm"
                  icon={ArrowLeftRight}
                  disabled={busy === s.id}
                  label={out ? t('toAccount') : t('fromAccount')}
                  onPress={() =>
                    resolve(
                      s,
                      {
                        action: 'to_account',
                        accountId: s.accountId!,
                        counterpartTransactionId: s.counterpartTransactionId,
                        remember: false,
                      },
                      out ? t('toAccount') : t('fromAccount'),
                    )
                  }
                />
              ) : null}
              <Button
                size="sm"
                variant="outline"
                icon={UserRound}
                disabled={busy === s.id}
                label={out ? t('toSomeone') : t('fromSomeone')}
                onPress={() =>
                  resolve(
                    s,
                    {
                      action: 'to_someone',
                      description: null,
                      categoryId: null,
                      remember: false,
                    },
                    out ? t('toSomeone') : t('fromSomeone'),
                  )
                }
              />
              <Button
                size="sm"
                variant="ghost"
                icon={X}
                disabled={busy === s.id}
                label={t('dismiss')}
                onPress={() =>
                  resolve(s, { action: 'dismiss' }, t('dismissed'))
                }
              />
            </TwView>
          </TwView>
        );
      })}
      {total > suggestions.length ? (
        <Text className="text-xs text-on-surface-variant">
          {t('more', { count: total - suggestions.length })}
        </Text>
      ) : null}
    </TwView>
  );
}
