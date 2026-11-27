import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'urql';
import { useTranslations } from 'use-intl';
import { ArrowLeft, Landmark, X } from 'lucide-react-native';

import { accountLabel } from '@finnit/core/finance/accounts';
import { todayKey } from '@finnit/core/finance/dates';
import {
  duplicateCheck,
  planForDuplicateAnswer,
} from '@finnit/core/new-entry/duplicates';
import { createErrorKey } from '@finnit/core/new-entry/errors';
import {
  buildTransactionInput,
  buildTransferInput,
  emptyEntryDraft,
  emptyTransferDraft,
  hasErrors,
  similarTransactionsArgs,
  validateEntry,
  validateTransfer,
  type CreateTransactionPayload,
  type EntryDraft,
  type EntryKind,
  type TransferDraft,
} from '@finnit/core/new-entry/form';
import {
  CREATE_TRANSACTION_MUTATION,
  CREATE_TRANSFER_MUTATION,
  NEW_ENTRY_DATA_QUERY,
  SIMILAR_TRANSACTIONS_QUERY,
  type NewEntryData,
  type SimilarTransaction,
} from '@finnit/core/new-entry/graphql';
import { hasCreditCard, isCardPayment } from '@finnit/core/new-entry/options';
import {
  CONFIRM_RECEIPT_MUTATION,
  type ReceiptImport,
} from '@finnit/core/receipts/graphql';
import {
  buildConfirmInput,
  prefillFromReceipt,
  type CheckField,
} from '@finnit/core/receipts/prefill';
import { TwPressable, TwScrollView, TwView } from '@finnit/ui-native/lib/tw';
import { useKeyboardHeight } from '@finnit/ui-native/lib/use-keyboard-height';
import { Button } from '@finnit/ui-native/components/ui/button';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { DuplicateReview } from '@/components/new-entry/duplicate-review';
import { ReceiptCapture } from '@/components/receipts/receipt-capture';
import { useReceiptReader } from '@/lib/receipts/use-receipt-reader';
import { EntryForm } from '@/components/new-entry/entry-form';
import { EntryKindPicker } from '@/components/new-entry/entry-kind-picker';
import {
  TransferForm,
  type LegPicks,
} from '@/components/new-entry/transfer-form';
import { useGql } from '@/lib/graphql/runner';
import { emitTransactionsChanged } from '@/lib/transactions/events';
import {
  legChoice,
  type TransferLegCandidates,
} from '@finnit/core/transfers/legs';

type Step =
  | { name: 'kind' }
  | { name: 'entry' }
  /** `cards`: "Pago a tarjeta de crédito", only cards as the destination. */
  | { name: 'transfer'; cards?: boolean }
  | { name: 'receipt' }
  | { name: 'duplicates'; matches: SimilarTransaction[] };
type Busy = 'checking' | 'saving' | null;

/**
 * "Nuevo movimiento" (the web's NewEntryFlow): gasto, ingreso or
 * transferencia, with the look-alike check before creating. The "+"
 * shortcuts open it on a step (`?action=`).
 */
export function NewEntryScreen() {
  const t = useTranslations();
  const router = useRouter();
  const gql = useGql();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  // Shortcuts may fill the form in: "Pagar tarjeta" (a transfer to the card
  // with what is left of its cycle) and "Registrar intereses" (an expense).
  const { action, to, account, amount, category, merchant, due } =
    useLocalSearchParams<{
      action?: string;
      to?: string;
      account?: string;
      amount?: string;
      category?: string;
      merchant?: string;
      due?: string;
    }>();
  const [{ data, fetching }] = useQuery<NewEntryData>({
    query: NEW_ENTRY_DATA_QUERY,
    requestPolicy: 'cache-and-network',
  });
  const accounts = React.useMemo(
    () => (data?.accounts.edges ?? []).map((e) => e.node),
    [data],
  );
  const categories = data?.categories ?? [];
  const onlyAccount = accounts.length === 1 ? accounts[0]!.id : undefined;

  const [step, setStep] = React.useState<Step>({ name: 'kind' });
  const [entry, setEntry] = React.useState<EntryDraft>(() =>
    emptyEntryDraft('expense', todayKey()),
  );
  const [transfer, setTransfer] = React.useState<TransferDraft>(() =>
    emptyTransferDraft(todayKey()),
  );
  const [legs, setLegs] = React.useState<TransferLegCandidates | null>(null);
  const [legPicks, setLegPicks] = React.useState<LegPicks>({});
  const [entryTried, setEntryTried] = React.useState(false);
  const [transferTried, setTransferTried] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<Busy>(null);
  const [pending, setPending] = React.useState<CreateTransactionPayload | null>(
    null,
  );
  const [receipt, setReceipt] = React.useState<ReceiptImport | null>(null);
  const [check, setCheck] = React.useState<CheckField[]>([]);
  const reader = useReceiptReader();
  const today = todayKey();

  // A read receipt: the expense form, filled from it, with fields to double-check.
  React.useEffect(() => {
    if (reader.state.phase !== 'ready') return;
    const read = reader.state.receipt;
    const prefill = prefillFromReceipt(
      { ...emptyEntryDraft('expense', todayKey()), accountId: onlyAccount },
      read,
      accounts,
      categories,
      todayKey(),
    );
    setEntry(prefill.draft);
    setCheck(prefill.check);
    setReceipt(read);
    setEntryTried(false);
    setStep({ name: 'entry' });
    reader.reset();
  }, [reader.state, reader, accounts, categories, onlyAccount]);

  const [initialApplied, setInitialApplied] = React.useState(!action);

  function pickKind(kind: EntryKind | 'cardPayment') {
    setSubmitError(null);
    setReceipt(null);
    setCheck([]);
    // Only the form the shortcut opened starts filled in.
    const filled = !initialApplied;
    if (kind === 'transfer' || kind === 'cardPayment') {
      const cards = kind === 'cardPayment';
      // With a single card, it is already the destination.
      const openCards = accounts.filter(
        (a) => a.type === 'credit' && !a.archived,
      );
      setTransfer({
        ...emptyTransferDraft(todayKey()),
        ...(cards && openCards.length === 1
          ? { toAccountId: openCards[0]!.id }
          : {}),
        ...(filled && to ? { toAccountId: to } : {}),
        ...(filled && amount ? { amount } : {}),
      });
      setLegPicks({});
      setTransferTried(false);
      setStep({ name: 'transfer', cards });
    } else {
      setEntry({
        ...emptyEntryDraft(kind, todayKey()),
        accountId: onlyAccount,
        ...(filled && account ? { accountId: account } : {}),
        ...(filled && amount ? { amount } : {}),
        ...(filled && category
          ? { categoryId: category, categoryPicked: true }
          : {}),
        ...(filled && merchant ? { merchant } : {}),
      });
      setEntryTried(false);
      setStep({ name: 'entry' });
    }
  }

  // Opened from a "+" shortcut: straight to that step once accounts load.
  if (!initialApplied && data) {
    setInitialApplied(true);
    if (
      action === 'expense' ||
      action === 'income' ||
      action === 'transfer' ||
      action === 'cardPayment'
    )
      pickKind(action);
    else if (action === 'receipt') setStep({ name: 'receipt' });
  }

  const finish = (message: string) => {
    toast.success(message);
    emitTransactionsChanged();
    router.back();
  };

  async function createEntry(payload: CreateTransactionPayload) {
    setBusy('saving');
    setSubmitError(null);
    try {
      await gql(CREATE_TRANSACTION_MUTATION, { input: payload });
      setBusy(null);
      finish(t(`newEntry.toasts.${payload.type}`));
    } catch (error) {
      setBusy(null);
      setSubmitError(t(`newEntry.errors.${createErrorKey(error)}`));
    }
  }

  async function confirmReceipt() {
    if (!receipt) return;
    setBusy('saving');
    setSubmitError(null);
    try {
      await gql(CONFIRM_RECEIPT_MUTATION, {
        id: receipt.id,
        input: buildConfirmInput(entry),
      });
      setBusy(null);
      toast.success(t('receipts.toasts.created'));
      finish(t('newEntry.toasts.expense'));
    } catch (error) {
      setBusy(null);
      setSubmitError(t(`newEntry.errors.${createErrorKey(error)}`));
    }
  }

  async function submitEntry() {
    const errors = validateEntry(entry, todayKey());
    setEntryTried(true);
    setSubmitError(null);
    const account = accounts.find((a) => a.id === entry.accountId);
    if (hasErrors(errors) || !account) return;
    if (receipt) {
      await confirmReceipt();
      return;
    }
    const payload = buildTransactionInput(entry, account);
    setPending(payload);
    setBusy('checking');
    let matches: SimilarTransaction[] = [];
    try {
      ({ similarTransactions: matches } = await gql<{
        similarTransactions: SimilarTransaction[];
      }>(SIMILAR_TRANSACTIONS_QUERY, similarTransactionsArgs(payload)));
    } catch {
      // The look-alike check is a convenience: create anyway.
    }
    const duplicates = duplicateCheck(matches);
    if (duplicates.kind === 'ask') {
      setBusy(null);
      setStep({ name: 'duplicates', matches: duplicates.matches });
      return;
    }
    await createEntry(payload);
  }

  function answerDuplicate(
    answer:
      | { kind: 'createAnyway' }
      | { kind: 'isThis'; transactionId: string },
  ) {
    const plan = planForDuplicateAnswer(answer, false);
    if (plan.kind === 'create') {
      if (pending) void createEntry(pending);
    } else {
      finish(t('newEntry.toasts.alreadyRegistered'));
    }
  }

  async function submitTransfer() {
    const errors = validateTransfer(transfer, accounts, todayKey());
    setTransferTried(true);
    setSubmitError(null);
    if (hasErrors(errors)) return;
    const to = accounts.find((a) => a.id === transfer.toAccountId)!;
    const cardPayment = to.type === 'credit';
    const input = buildTransferInput(
      transfer,
      t(
        cardPayment
          ? 'newEntry.defaultCardPaymentDescription'
          : 'newEntry.defaultTransferDescription',
        {
          account: accountLabel(to),
        },
      ),
      {
        from: legs ? legChoice(legs.from, legPicks.from) : null,
        to: legs ? legChoice(legs.to, legPicks.to) : null,
      },
    );
    setBusy('saving');
    try {
      await gql(CREATE_TRANSFER_MUTATION, { input });
      setBusy(null);
      finish(
        t(
          cardPayment
            ? 'newEntry.toasts.cardPayment'
            : 'newEntry.toasts.transfer',
        ),
      );
    } catch (error) {
      setBusy(null);
      setSubmitError(t(`newEntry.errors.${createErrorKey(error)}`));
    }
  }

  const title =
    step.name === 'entry'
      ? t(`newEntry.titles.${entry.type}`)
      : step.name === 'transfer'
        ? step.cards || isCardPayment(accounts, transfer.toAccountId)
          ? t('newEntry.titles.cardPayment')
          : t('newEntry.titles.transfer')
        : step.name === 'duplicates'
          ? t('newEntry.titles.duplicates')
          : step.name === 'receipt'
            ? t('receipts.titles.capture')
            : t('newEntry.title');
  const busyLabel =
    busy === 'checking' ? t('newEntry.checking') : t('newEntry.saving');

  /*
   * Back within the flow: from the look-alikes to the form, and from a
   * receipt's expense to the camera. On the step a shortcut opened (the
   * "+" already lists the kinds) it closes the sheet instead of showing
   * the kind picker.
   */
  const backTarget: Step | 'close' | null =
    step.name === 'duplicates'
      ? { name: 'entry' }
      : step.name === 'entry' && action === 'receipt'
        ? { name: 'receipt' }
        : action
          ? 'close'
          : step.name === 'kind'
            ? null
            : { name: 'kind' };
  function goBack() {
    setSubmitError(null);
    if (backTarget === 'close') router.back();
    else if (backTarget) setStep(backTarget);
  }

  let body: React.ReactNode;
  if (!data && fetching)
    body = <ActivityIndicator style={{ marginVertical: 32 }} />;
  else if (accounts.length === 0)
    body = (
      <EmptyState
        icon={Landmark}
        title={t('newEntry.noAccounts.title')}
        description={t('newEntry.noAccounts.description')}
        action={{
          label: t('common.connectBank'),
          onPress: () => {
            router.back();
            router.push('/connect-bank');
          },
        }}
      />
    );
  else if (action === 'screenshot' && step.name === 'kind')
    body = (
      <Text className="py-6 text-center text-on-surface-variant">
        {t('common.comingSoon')}
      </Text>
    );
  else if (step.name === 'receipt')
    body = (
      <ReceiptCapture
        state={reader.state}
        onPick={(file) => void reader.read(file)}
        onCancel={() => {
          reader.reset();
          if (action) router.back();
          else setStep({ name: 'kind' });
        }}
        onManual={() => {
          reader.reset();
          pickKind('expense');
        }}
      />
    );
  else if (step.name === 'kind')
    body = (
      <EntryKindPicker
        onPick={pickKind}
        withCardPayment={hasCreditCard(accounts)}
      />
    );
  else if (step.name === 'entry')
    body = (
      <EntryForm
        check={check}
        draft={entry}
        onChange={setEntry}
        accounts={accounts}
        categories={categories}
        errors={entryTried ? validateEntry(entry, today) : {}}
        busy={busy !== null}
        submitError={submitError}
      />
    );
  else if (step.name === 'transfer')
    body = (
      <TransferForm
        legs={legs}
        onLegs={setLegs}
        legPicks={legPicks}
        onLegPick={(side, id) =>
          setLegPicks((current) => ({ ...current, [side]: id }))
        }
        draft={transfer}
        onChange={setTransfer}
        accounts={accounts}
        errors={
          transferTried ? validateTransfer(transfer, accounts, today) : {}
        }
        busy={busy !== null}
        submitError={submitError}
        cardDueDate={due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : undefined}
        onlyCards={step.cards}
      />
    );
  else
    body = (
      <DuplicateReview
        matches={step.matches}
        busy={busy !== null}
        error={submitError}
        onIsThis={(transactionId) =>
          answerDuplicate({ kind: 'isThis', transactionId })
        }
      />
    );

  // The form's main button, pinned under the scrolling fields: right
  // above the keyboard while typing.
  const footerAction =
    step.name === 'entry'
      ? {
          label: busy ? busyLabel : t(`newEntry.submit.${entry.type}`),
          onPress: () => void submitEntry(),
        }
      : step.name === 'transfer'
        ? {
            label: busy
              ? busyLabel
              : isCardPayment(accounts, transfer.toAccountId)
                ? t('newEntry.submit.cardPayment')
                : t('newEntry.submit.transfer'),
            onPress: () => void submitTransfer(),
          }
        : step.name === 'duplicates'
          ? {
              label: busy
                ? t('newEntry.saving')
                : t('newEntry.duplicates.createAnyway'),
              onPress: () => answerDuplicate({ kind: 'createAnyway' }),
            }
          : null;

  return (
    <TwView className="flex-1 bg-popover">
      {/* No KeyboardAvoidingView (inside a sheet it moved the whole sheet):
        the space under the button grows with the keyboard instead. */}
      <TwScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        className="flex-1"
        contentContainerClassName="gap-4 px-5 pt-6"
        contentContainerStyle={{
          paddingBottom: footerAction ? 16 : Math.max(24, insets.bottom),
        }}
      >
        <TwView className="flex-row items-center gap-2">
          {backTarget ? (
            <TwPressable
              accessibilityRole="button"
              accessibilityLabel={
                backTarget === 'close' ? t('common.close') : t('newEntry.back')
              }
              onPress={goBack}
              className="-ml-2 size-11 items-center justify-center rounded-full active:bg-accent"
            >
              <Icon icon={backTarget === 'close' ? X : ArrowLeft} size={22} />
            </TwPressable>
          ) : null}
          <Text
            accessibilityRole="header"
            weight="bold"
            className="flex-1 text-lg"
          >
            {title}
          </Text>
        </TwView>
        {step.name === 'kind' ? (
          <Text className="-mt-2 text-sm text-on-surface-variant">
            {t('newEntry.description')}
          </Text>
        ) : null}
        {body}
      </TwScrollView>
      {footerAction ? (
        <TwView className="px-5 pt-3">
          <Button
            label={footerAction.label}
            disabled={busy !== null}
            onPress={footerAction.onPress}
            className="w-full"
          />
        </TwView>
      ) : null}
      <View
        style={{
          height:
            keyboard > 0
              ? keyboard + 12
              : footerAction
                ? Math.max(16, insets.bottom)
                : 0,
        }}
      />
    </TwView>
  );
}
