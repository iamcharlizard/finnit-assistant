import * as React from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { ArrowLeftRight, Lock, LockKeyhole, Tags, Trash2, Text as TextIcon } from 'lucide-react-native';

import { deleteAlias, setAliasActive } from '@finnit/core/aliases/api';
import { ALIASES_QUERY, aliasesData, aliasesVariables, type AliasesResult } from '@finnit/core/aliases/request';
import type { ApiMerchantAlias } from '@finnit/core/aliases/types';
import { todayKey } from '@finnit/core/finance/dates';
import { formatMoney } from '@finnit/core/finance/money';
import { requestErrorMessage } from '@finnit/core/graphql/request';
import { isPrivacyLocked } from '@finnit/core/privacy/pin';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Badge } from '@finnit/ui-native/components/ui/badge';
import { Button } from '@finnit/ui-native/components/ui/button';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Switch } from '@finnit/ui-native/components/ui/switch';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { Screen } from '@/components/shell/screen';
import { useGql } from '@/lib/graphql/runner';
import { useView } from '@/lib/graphql/use-view';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { useOnTransactionsChanged } from '@/lib/transactions/events';

/** Configuración → Nombres automáticos: each with its pattern, spending, on/off and delete. */
export function AliasesScreen() {
  const t = useTranslations('aliases');
  const tc = useTranslations('common');
  const l = useLocalizer();
  const gql = useGql();
  const router = useRouter();
  const today = todayKey();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const { view, loading, error, refreshing, refresh } = useView({
    query: ALIASES_QUERY,
    variables: aliasesVariables(today),
    build: (data: AliasesResult) => aliasesData(data, today),
  });
  // Unlocked with the PIN: reload (protected names show their patterns).
  useOnTransactionsChanged((id) => id === null && refresh());

  const fail = (e: unknown) => {
    if (isPrivacyLocked(e)) router.push('/privacy-unlock');
    else toast.error(requestErrorMessage(e, l.t));
  };

  async function toggle(alias: ApiMerchantAlias, active: boolean) {
    setBusyId(alias.id);
    try {
      await setAliasActive(alias, active, gql);
      refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusyId(null);
    }
  }

  function askDelete(alias: ApiMerchantAlias) {
    Alert.alert(t('deleteDialog.title', { name: alias.displayName }), t('deleteDialog.description'), [
      { text: tc('cancel'), style: 'cancel' },
      {
        text: t('deleteDialog.confirm'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(alias.id);
          try {
            await deleteAlias(alias.id, gql);
            toast.success(t('toasts.deleted'));
            refresh();
          } catch (e) {
            fail(e);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  const money = (amount: number, currency: string) => formatMoney(amount, currency, l.locale);

  return (
    <Screen title={t('title')} subtitle={t('subtitle')} back withBottomNav={false} loading={loading} error={error} refreshing={refreshing} onRefresh={refresh}>
      {view ? (
        <TwView className="gap-4">
          <Button variant="link" icon={Tags} label={t('categorizeLink')} className="self-start" onPress={() => router.navigate('/transactions/categorize')} />
          {view.aliases.length === 0 ? (
            <EmptyState icon={TextIcon} title={t('emptyTitle')} description={t('emptyDescription')} />
          ) : (
            <>
              <Text className="px-1 text-xs text-on-surface-variant">{t('count', { count: view.aliases.length })}</Text>
              {view.aliases.map((alias) => {
                const locked = alias.locked;
                const transferAccount = alias.transferAccountId ? view.accountNames[alias.transferAccountId] : undefined;
                const details = [
                  alias.category?.name ?? t('noCategory'),
                  t('matches', { count: alias.matchCount }),
                  alias.priority !== 0 ? t('priority', { priority: alias.priority }) : null,
                ].filter(Boolean);
                return (
                  <TwView key={alias.id} className={cn('gap-3 rounded-card bg-surface p-4', !alias.active && 'opacity-75')}>
                    <TwView className="flex-row items-start justify-between gap-3">
                      <TwView className="min-w-0 flex-1 gap-1">
                        <TwView className="flex-row flex-wrap items-center gap-2">
                          {alias.isPrivate ? <Icon icon={Lock} size={16} color="--on-surface-variant" /> : null}
                          <Text weight="medium" className="shrink text-base">
                            {alias.displayName}
                          </Text>
                          {alias.isProtected ? (
                            <Badge variant="highlight" label={t('protected')} />
                          ) : alias.isPrivate ? (
                            <Badge variant="muted" label={t('private')} />
                          ) : null}
                          {!alias.active ? <Badge variant="outline" label={t('inactive')} /> : null}
                        </TwView>
                        <Text className="text-xs text-on-surface-variant">
                          {locked || alias.pattern === null ? t('lockedPattern') : `${t(`matchShort.${alias.matchType}`)}: ${alias.pattern}`}
                        </Text>
                        <Text className="text-xs text-on-surface-variant">{details.join(' · ')}</Text>
                        {transferAccount ? (
                          <TwView className="flex-row items-center gap-1">
                            <Icon icon={ArrowLeftRight} size={14} color="--on-surface-variant" />
                            <Text className="text-xs text-on-surface-variant">{t('transferTo', { account: transferAccount })}</Text>
                          </TwView>
                        ) : null}
                        {alias.month ? (
                          <Text className="mt-1 text-sm">
                            {t('spending.month', { amount: money(alias.month.total, alias.month.currency), count: alias.month.count })}
                            {alias.year && alias.year.count > 0 ? (
                              <Text className="text-sm text-on-surface-variant">{` · ${t('spending.year', { amount: money(alias.year.total, alias.year.currency) })}`}</Text>
                            ) : null}
                          </Text>
                        ) : null}
                      </TwView>
                      <Switch
                        checked={alias.active}
                        disabled={busyId === alias.id}
                        onCheckedChange={(active) => (locked ? router.push('/privacy-unlock') : void toggle(alias, active))}
                        accessibilityLabel={t('activeLabel', { name: alias.displayName })}
                      />
                    </TwView>
                    <TwView className="flex-row flex-wrap items-center justify-between gap-1">
                      <Button
                        variant="link"
                        size="sm"
                        label={t('spending.view')}
                        onPress={() => router.navigate({ pathname: '/history', params: { alias: alias.id, month: view.month } })}
                      />
                      {locked ? (
                        <Button variant="outline" size="sm" icon={LockKeyhole} label={t('unlock')} onPress={() => router.push('/privacy-unlock')} />
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          label={t('deleteLabel', { name: alias.displayName })}
                          disabled={busyId === alias.id}
                          onPress={() => askDelete(alias)}
                        />
                      )}
                    </TwView>
                  </TwView>
                );
              })}
            </>
          )}
        </TwView>
      ) : null}
    </Screen>
  );
}
