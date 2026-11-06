import * as React from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { CheckCheck, Landmark, PencilLine, Trash2, Undo2, Unlink } from 'lucide-react-native';

import { todayKey } from '@finnit/core/finance/dates';
import { deleteTransaction, transactionErrorMessage, updateTransaction } from '@finnit/core/transaction-detail/api';
import {
  TRANSACTION_DETAIL_QUERY,
  buildTransactionDetailData,
  type TransactionDetailResult,
} from '@finnit/core/transaction-detail/request';
import { UNDO_TRANSFER_CONVERSION_MUTATION } from '@finnit/core/transfers/convert';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { LinkLoanSheet } from '@/components/loan-links/link-loan-sheet';
import { UnlinkLoanSheet } from '@/components/loan-links/unlink-loan-sheet';
import { Screen } from '@/components/shell/screen';
import { TransactionEditSheet } from '@/components/transaction-detail/transaction-edit-sheet';
import { TransactionFacts } from '@/components/transaction-detail/transaction-facts';
import { TransactionSummary } from '@/components/transaction-detail/transaction-summary';
import { useGql } from '@/lib/graphql/runner';
import { useView } from '@/lib/graphql/use-view';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { emitTransactionsChanged, useOnTransactionsChanged } from '@/lib/transactions/events';

/** One movement: its data, edits and deletion (the web's drawer / modal). */
export function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations('transaction');
  const tx = useTranslations('transfers');
  const tc = useTranslations('common');
  const tl = useTranslations('debts.links');
  const l = useLocalizer();
  const gql = useGql();
  const router = useRouter();
  const today = todayKey();
  const [editing, setEditing] = React.useState(false);
  const [loanSheet, setLoanSheet] = React.useState<'link' | 'unlink' | null>(null);
  const [busy, setBusy] = React.useState(false);

  const { view: data, loading, error, refreshing, refresh } = useView({
    query: TRANSACTION_DETAIL_QUERY,
    variables: { id },
    build: (result: TransactionDetailResult, loc) => buildTransactionDetailData(result, today, loc),
  });

  // Unlocked with the PIN (or changed elsewhere): reload.
  useOnTransactionsChanged((changedId) => {
    if (changedId === null) refresh();
  });

  const changed = () => {
    refresh();
    emitTransactionsChanged(id);
  };

  function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    action()
      .then(() => {
        toast.success(done);
        changed();
      })
      .catch((e: unknown) => toast.error(transactionErrorMessage(e, l.t)))
      .finally(() => setBusy(false));
  }

  function askDelete() {
    if (!data) return;
    Alert.alert(t('deleteTitle'), t('deleteDescription', { account: data.view.accountLabel }), [
      { text: tc('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          deleteTransaction(data.view.id, gql)
            .then(() => {
              toast.success(t('toasts.deleted'));
              emitTransactionsChanged(id);
              router.back();
            })
            .catch((e: unknown) => {
              toast.error(transactionErrorMessage(e, l.t));
              setBusy(false);
            });
        },
      },
    ]);
  }

  function askUndo(transferId: string) {
    Alert.alert(tx('undo.title'), tx('undo.description'), [
      { text: tc('cancel'), style: 'cancel' },
      { text: tx('undo.confirm'), onPress: () => run(() => gql(UNDO_TRANSFER_CONVERSION_MUTATION, { transferId }), tx('undo.done')) },
    ]);
  }

  const view = data?.view;
  return (
    <Screen
      title={t('detailsTitle')}
      back
      withBottomNav={false}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {data && view ? (
        <TwView className="gap-5">
          <TransactionSummary view={view} onUnlock={() => router.push('/privacy-unlock')} />
          <TwView className="flex-row flex-wrap gap-2">
            <Button variant="outline" icon={PencilLine} label={t('edit')} onPress={() => setEditing(true)} />
            {view.canLinkLoan ? <Button variant="outline" icon={Landmark} label={tl('linkAction')} onPress={() => setLoanSheet('link')} /> : null}
            {view.loan?.occurrenceId ? <Button variant="outline" icon={Unlink} label={tl('unlink.action')} onPress={() => setLoanSheet('unlink')} /> : null}
            {view.counterpart?.converted ? (
              <Button
                variant="outline"
                icon={Undo2}
                label={tx('undo.action')}
                disabled={busy}
                onPress={() => askUndo(view.counterpart!.transferId)}
              />
            ) : null}
            {view.inProcess ? (
              <Button
                variant="outline"
                icon={CheckCheck}
                label={t('markApplied')}
                disabled={busy}
                onPress={() => run(() => updateTransaction(view.id, { inProcess: false }, gql), t('markedApplied'))}
              />
            ) : null}
            {view.deleteBlock === null ? (
              <Button variant="destructive" icon={Trash2} label={t('delete')} disabled={busy} onPress={askDelete} />
            ) : null}
          </TwView>
          {view.deleteBlock ? (
            <Text className="-mt-2 text-xs text-on-surface-variant">{t(`deleteBlocked.${view.deleteBlock}`)}</Text>
          ) : null}
          <TransactionFacts view={view} merchant={data.form.merchantName} description={data.form.description} />
          {loanSheet === 'link' ? (
            <LinkLoanSheet
              transactionId={view.id}
              amountLabel={view.amount}
              onClose={() => setLoanSheet(null)}
              onLinked={(name) => {
                setLoanSheet(null);
                toast.success(tl('done', { name }));
                changed();
              }}
            />
          ) : null}
          {loanSheet === 'unlink' && view.loan?.occurrenceId ? (
            <UnlinkLoanSheet
              occurrenceId={view.loan.occurrenceId}
              onClose={() => setLoanSheet(null)}
              onUnlinked={() => {
                setLoanSheet(null);
                toast.success(tl('unlink.done'));
                changed();
              }}
            />
          ) : null}
          {editing ? (
            <TransactionEditSheet
              open
              transactionId={view.id}
              initial={data.form}
              rules={view.rules}
              subject={view.name}
              currency={data.currency}
              categories={data.categories}
              categoryKind={data.categoryKind}
              isTransfer={view.counterpart !== null}
              imported={view.sourceKind !== 'manual'}
              today={today}
              onClose={() => setEditing(false)}
              onSaved={(didChange) => {
                setEditing(false);
                if (!didChange) {
                  toast.info(t('toasts.noChanges'));
                  return;
                }
                toast.success(t('toasts.saved'));
                changed();
              }}
            />
          ) : null}
        </TwView>
      ) : null}
    </Screen>
  );
}
