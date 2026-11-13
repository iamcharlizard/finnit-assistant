import * as React from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import {
  ArrowLeftRight,
  Ban,
  CalendarClock,
  CheckCheck,
  CopyCheck,
  CreditCard,
  Landmark,
  MoreHorizontal,
  PencilLine,
  Repeat,
  RotateCcw,
  Trash2,
  Undo2,
  Unlink,
} from 'lucide-react-native';

import { dayKeyOf, todayKey } from '@finnit/core/finance/dates';
import {
  deleteTransaction,
  transactionErrorMessage,
  updateTransaction,
} from '@finnit/core/transaction-detail/api';
import {
  TRANSACTION_DETAIL_QUERY,
  buildTransactionDetailData,
  type TransactionDetailResult,
} from '@finnit/core/transaction-detail/request';
import { runPaymentAction } from '@finnit/core/recurring/api';
import {
  cancelTransaction,
  cancellationNote,
  loadCancellationCheck,
  restoreTransaction,
} from '@finnit/core/transaction-detail/cancellation';
import {
  UNDO_TRANSFER_CONVERSION_MUTATION,
  type ConvertMode,
} from '@finnit/core/transfers/convert';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { MergeDuplicateSheet } from '@/components/duplicates/merge-duplicate-sheet';
import { LinkLoanSheet } from '@/components/loan-links/link-loan-sheet';
import { UnlinkLoanSheet } from '@/components/loan-links/unlink-loan-sheet';
import { LinkRecurringSheet } from '@/components/recurring-links/link-recurring-sheet';
import { LinkCardInstallmentSheet } from '@/components/card-installments/link-card-installment-sheet';
import { ConvertTransferSheet } from '@/components/transfers/convert-transfer-sheet';
import {
  ActionsSheet,
  type DetailAction,
} from '@/components/transaction-detail/actions-sheet';
import { Screen } from '@/components/shell/screen';
import { TransactionEditSheet } from '@/components/transaction-detail/transaction-edit-sheet';
import { TransactionFacts } from '@/components/transaction-detail/transaction-facts';
import { TransactionSummary } from '@/components/transaction-detail/transaction-summary';
import { useGql } from '@/lib/graphql/runner';
import { useView } from '@/lib/graphql/use-view';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import {
  emitTransactionsChanged,
  useOnTransactionsChanged,
} from '@/lib/transactions/events';

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
  const [cardSheet, setCardSheet] = React.useState(false);
  const [convertSheet, setConvertSheet] = React.useState<ConvertMode | null>(
    null,
  );
  const [loanSheet, setLoanSheet] = React.useState<'link' | 'unlink' | null>(
    null,
  );
  const [busy, setBusy] = React.useState(false);
  const [merging, setMerging] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [recurringSheet, setRecurringSheet] = React.useState(false);

  const {
    view: data,
    loading,
    error,
    refreshing,
    refresh,
  } = useView({
    query: TRANSACTION_DETAIL_QUERY,
    variables: { id },
    build: (result: TransactionDetailResult, loc) =>
      buildTransactionDetailData(result, today, loc),
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

  /** The statement's word on it, or the reminder to check it. */
  async function statementNote(movementId: string): Promise<string> {
    setBusy(true);
    const check = await loadCancellationCheck(movementId, gql);
    setBusy(false);
    return cancellationNote(check, l);
  }

  const cancelIt = (movementId: string) =>
    run(() => cancelTransaction(movementId, gql), t('cancel.done'));

  async function askCancel() {
    if (!data) return;
    const movementId = data.view.id;
    const note = await statementNote(movementId);
    Alert.alert(t('cancel.title'), [t('cancel.description'), note].join('\n\n'), [
      { text: tc('cancel'), style: 'cancel' },
      { text: t('cancel.confirm'), onPress: () => cancelIt(movementId) },
    ]);
  }

  async function askDelete() {
    if (!data) return;
    const view = data.view;
    // On a card, deleting also offers marking it cancelled (with what its
    // statement shows).
    const note = view.canCancel ? await statementNote(view.id) : null;
    const description = [
      t('deleteDescription', { account: view.accountLabel }),
      ...view.deleteNotes,
      ...(note ? [t('cancel.deleteSuggestion'), note] : []),
    ].join('\n\n');
    Alert.alert(t('deleteTitle'), description, [
      { text: tc('cancel'), style: 'cancel' },
      ...(view.canCancel
        ? [{ text: t('cancel.action'), onPress: () => cancelIt(view.id) }]
        : []),
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
      {
        text: tx('undo.confirm'),
        onPress: () =>
          run(
            () => gql(UNDO_TRANSFER_CONVERSION_MUTATION, { transferId }),
            tx('undo.done'),
          ),
      },
    ]);
  }

  function askUnlinkRecurring(occurrenceId: string) {
    Alert.alert(t('unlinkRecurring.title'), t('unlinkRecurring.description'), [
      { text: tc('cancel'), style: 'cancel' },
      {
        text: t('unlinkRecurring.confirm'),
        onPress: () =>
          run(
            () => runPaymentAction('reopen', occurrenceId, gql),
            t('unlinkRecurring.done'),
          ),
      },
    ]);
  }

  const view = data?.view;
  const actions: DetailAction[] = view
    ? [
        ...(view.convertSource
          ? [
              {
                key: 'convert',
                label: tx('convert.action'),
                icon: ArrowLeftRight,
                run: () => setConvertSheet('transfer'),
              },
            ]
          : []),
        ...(view.convertSource && view.canRecordCardPayment
          ? [
              {
                key: 'cardPayment',
                label: tx('cardPayment.action'),
                icon: CreditCard,
                run: () => setConvertSheet('cardPayment'),
              },
            ]
          : []),
        ...(view.counterpart?.converted
          ? [
              {
                key: 'undo',
                label: tx('undo.action'),
                icon: Undo2,
                disabled: busy,
                run: () => askUndo(view.counterpart!.transferId),
              },
            ]
          : []),
        ...(view.canLinkRecurring
          ? [
              {
                key: 'linkRecurring',
                label: t('linkRecurring.action'),
                icon: Repeat,
                run: () => setRecurringSheet(true),
              },
            ]
          : []),
        ...(view.recurring
          ? [
              {
                key: 'unlinkRecurring',
                label: t('unlinkRecurring.action'),
                icon: Unlink,
                disabled: busy,
                run: () => askUnlinkRecurring(view.recurring!.occurrenceId),
              },
            ]
          : []),
        ...(view.canLinkCardInstallment
          ? [
              {
                key: 'linkCardInstallment',
                label: t('linkCardInstallment.action'),
                icon: CalendarClock,
                run: () => setCardSheet(true),
              },
            ]
          : []),
        ...(view.canLinkLoan
          ? [
              {
                key: 'linkLoan',
                label: tl('linkAction'),
                icon: Landmark,
                run: () => setLoanSheet('link'),
              },
            ]
          : []),
        ...(view.loan?.occurrenceId
          ? [
              {
                key: 'unlinkLoan',
                label: tl('unlink.action'),
                icon: Unlink,
                run: () => setLoanSheet('unlink'),
              },
            ]
          : []),
        ...(view.mergeable
          ? [
              {
                key: 'merge',
                label: t('markDuplicate'),
                icon: CopyCheck,
                run: () => setMerging(true),
              },
            ]
          : []),
        ...(view.canCancel
          ? [
              {
                key: 'cancel',
                label: t('cancel.action'),
                icon: Ban,
                disabled: busy,
                run: () => void askCancel(),
              },
            ]
          : []),
        ...(view.cancelled
          ? [
              {
                key: 'restore',
                label: t('cancel.restore'),
                icon: RotateCcw,
                disabled: busy,
                run: () =>
                  run(() => restoreTransaction(view.id, gql), t('cancel.restored')),
              },
            ]
          : []),
        ...(view.deleteBlock === null
          ? [
              {
                key: 'delete',
                label: t('delete'),
                icon: Trash2,
                disabled: busy,
                destructive: true,
                run: () => void askDelete(),
              },
            ]
          : []),
      ]
    : [];
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
          <TransactionSummary
            view={view}
            onUnlock={() => router.push('/privacy-unlock')}
          />
          {/* "Editar" first; every other action in the "⋯" sheet (deleting last, in red). */}
          <TwView className="flex-row flex-wrap items-center gap-2">
            <Button
              variant="outline"
              icon={PencilLine}
              label={t('edit')}
              onPress={() => setEditing(true)}
            />
            {view.inProcess ? (
              <Button
                variant="outline"
                icon={CheckCheck}
                label={t('markApplied')}
                disabled={busy}
                onPress={() =>
                  run(
                    () => updateTransaction(view.id, { inProcess: false }, gql),
                    t('markedApplied'),
                  )
                }
              />
            ) : null}
            {actions.length > 0 ? (
              <Button
                variant="outline"
                size="icon"
                icon={MoreHorizontal}
                label={t('moreActions')}
                className="rounded-full"
                onPress={() => setMenuOpen(true)}
              />
            ) : null}
          </TwView>
          {view.deleteBlock ? (
            <Text className="-mt-2 text-xs text-on-surface-variant">
              {t(`deleteBlocked.${view.deleteBlock}`)}
            </Text>
          ) : null}
          <TransactionFacts
            view={view}
            merchant={data.form.merchantName}
            description={data.form.description}
          />
          {merging ? (
            <MergeDuplicateSheet
              transaction={data.transaction}
              onClose={() => setMerging(false)}
              onMerged={(keptId) => {
                setMerging(false);
                toast.success(l.t('duplicates.toasts.merged'));
                emitTransactionsChanged(null);
                // This one may be the copy that went: show the one that stays.
                if (keptId === view.id) refresh();
                else
                  router.replace({
                    pathname: '/transaction/[id]',
                    params: { id: keptId },
                  });
              }}
            />
          ) : null}
          {menuOpen ? (
            <ActionsSheet
              title={t('moreActions')}
              closeLabel={tc('close')}
              actions={actions}
              onClose={() => setMenuOpen(false)}
            />
          ) : null}
          {recurringSheet ? (
            <LinkRecurringSheet
              transaction={data.transaction}
              onClose={() => setRecurringSheet(false)}
              onLinked={(name) => {
                setRecurringSheet(false);
                toast.success(t('linkRecurring.done', { name }));
                changed();
              }}
            />
          ) : null}
          {convertSheet && view.convertSource ? (
            <ConvertTransferSheet
              source={view.convertSource}
              mode={convertSheet}
              onClose={() => setConvertSheet(null)}
              onConverted={() => {
                const mode = convertSheet;
                setConvertSheet(null);
                toast.success(
                  tx(
                    mode === 'cardPayment'
                      ? 'cardPayment.done'
                      : 'convert.done',
                  ),
                );
                changed();
              }}
            />
          ) : null}
          {cardSheet ? (
            <LinkCardInstallmentSheet
              transaction={data.transaction}
              onClose={() => setCardSheet(false)}
              onChanged={(message) => {
                setCardSheet(false);
                toast.success(message);
                changed();
              }}
              onCreate={() => {
                setCardSheet(false);
                router.push({
                  pathname: '/new-debt',
                  params: {
                    kind: 'card_installments',
                    account: data.transaction.accountId,
                    amount: data.transaction.amount.toFixed(2),
                    date: dayKeyOf(data.transaction.txnDate),
                    name: view.title,
                    tx: data.transaction.id,
                  },
                });
              }}
            />
          ) : null}
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
