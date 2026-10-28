'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { SheetDescription, SheetTitle } from '@finnit/ui/components/ui/sheet';
import { toast } from '@finnit/ui/components/ui/toaster';

import { useAttachmentUpload } from '@/hooks/use-attachment-upload';
import { useNewEntryData } from '@/hooks/use-new-entry-data';
import { usePendingReceipts } from '@/hooks/use-pending-receipts';
import { useReceiptReader } from '@/hooks/use-receipt-reader';
import { accountLabel } from '@/lib/finance/accounts';
import { todayKey } from '@/lib/finance/dates';
import { gql } from '@/lib/graphql/client';
import {
  duplicateCheck,
  planForDuplicateAnswer,
} from '@/lib/new-entry/duplicates';
import { createErrorKey } from '@/lib/new-entry/errors';
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
} from '@/lib/new-entry/form';
import {
  CREATE_TRANSACTION_MUTATION,
  CREATE_TRANSFER_MUTATION,
  SIMILAR_TRANSACTIONS_QUERY,
  type SimilarTransaction,
} from '@/lib/new-entry/graphql';
import { isCardPayment, transferSources } from '@/lib/new-entry/options';
import {
  CONFIRM_RECEIPT_MUTATION,
  DISCARD_RECEIPT_MUTATION,
  RECEIPT_STATUS_QUERY,
  type ReceiptImport,
  type ReceiptStatus,
} from '@/lib/receipts/graphql';
import { discardWhenSettled } from '@/lib/receipts/discard';
import {
  buildConfirmInput,
  prefillFromReceipt,
  receiptMatches,
  type CheckField,
} from '@/lib/receipts/prefill';
import { leftoverReceiptId } from '@/lib/receipts/reader';
import { PendingReceipts } from '@/components/receipts/pending-receipts';
import { ReceiptCapture } from '@/components/receipts/receipt-capture';
import { ReceiptMatchReview } from '@/components/receipts/receipt-match-review';
import { ReceiptReadFailed } from '@/components/receipts/receipt-read-failed';
import { ReceiptReading } from '@/components/receipts/receipt-reading';
import { ReceiptSummary } from '@/components/receipts/receipt-summary';
import { ScanReceiptButton } from '@/components/receipts/scan-receipt-button';
import { AttachmentUploadStatus } from './attachment-upload-status';
import { DuplicateReview } from './duplicate-review';
import { EntryForm } from './entry-form';
import { EntryKindPicker } from './entry-kind-picker';
import { TransferForm } from './transfer-form';

type Step =
  | { name: 'kind' }
  | { name: 'entry' }
  | { name: 'transfer' }
  | { name: 'duplicates'; matches: SimilarTransaction[] }
  /** Receipt capture: pick the photo, upload, read (or why it couldn't). */
  | { name: 'receipt' }
  /** A read receipt that may already be registered. */
  | { name: 'receiptMatch'; matches: SimilarTransaction[] }
  | {
      name: 'upload';
      transactionId: string;
      /** A new movement (vs. a receipt added to one that already existed). */
      created: boolean;
    };

type Busy = null | 'checking' | 'saving';

/**
 * Fire and forget: an import nobody will review (failed, cancelled). Waits
 * for the read to end if needed; on failure it only shows up again as
 * pending.
 */
function discardQuietly(receiptId: string) {
  void discardWhenSettled(receiptId, {
    fetchStatus: async (id) =>
      (
        await gql<{ receiptImport: { status: ReceiptStatus } }>(
          RECEIPT_STATUS_QUERY,
          { id },
        )
      ).receiptImport.status,
    discard: (id) => gql(DISCARD_RECEIPT_MUTATION, { id }),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
}

/**
 * "Nuevo movimiento", inside the sheet: pick the kind, fill the form, check
 * for duplicates, create, then upload the receipt. Expenses can start from
 * a receipt photo instead ("Escanear ticket"): the server reads it, the form
 * comes pre-filled, and confirming registers it with the photo attached.
 * Mounted while the sheet is open, so every opening starts fresh.
 */
export function NewEntryFlow({
  onDone,
  onLockChange,
}: {
  onDone: () => void;
  /** True while closing would interrupt a save or an upload. */
  onLockChange: (locked: boolean) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { state: data, reload } = useNewEntryData(true);
  const attachment = useAttachmentUpload();

  const [step, setStep] = React.useState<Step>({ name: 'kind' });
  const [entry, setEntry] = React.useState<EntryDraft>(() =>
    emptyEntryDraft('expense', todayKey()),
  );
  const [transfer, setTransfer] = React.useState<TransferDraft>(() =>
    emptyTransferDraft(todayKey()),
  );
  const [file, setFile] = React.useState<File | null>(null);
  // Errors show after the first submit, then follow what the user types.
  const [entryTried, setEntryTried] = React.useState(false);
  const [transferTried, setTransferTried] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<Busy>(null);
  const [pending, setPending] = React.useState<CreateTransactionPayload | null>(
    null,
  );
  // Receipt capture: the read import behind the form, its fields to check,
  // where the capture started and the photo picked.
  const [receipt, setReceipt] = React.useState<ReceiptImport | null>(null);
  const [check, setCheck] = React.useState<CheckField[]>([]);
  const [captureFrom, setCaptureFrom] = React.useState<'kind' | 'entry'>(
    'kind',
  );
  const [photo, setPhoto] = React.useState<File | null>(null);

  const today = todayKey();
  const entryErrors = entryTried ? validateEntry(entry, today) : {};

  const accounts = React.useMemo(
    () => (data.status === 'ready' ? data.accounts : []),
    [data],
  );
  const categories = React.useMemo(
    () => (data.status === 'ready' ? data.categories : []),
    [data],
  );

  const onlyAccount = accounts.length === 1 ? accounts[0]!.id : undefined;
  const freshExpense = (): EntryDraft => ({
    ...emptyEntryDraft('expense', todayKey()),
    accountId: onlyAccount,
  });

  function applyReceipt(read: ReceiptImport, from: 'kind' | 'entry') {
    const base =
      from === 'entry' && entry.type === 'expense' ? entry : freshExpense();
    const prefill = prefillFromReceipt(
      base,
      read,
      accounts,
      categories,
      todayKey(),
    );
    setEntry(prefill.draft);
    setCheck(prefill.check);
    setReceipt(read);
    setFile(null);
    setEntryTried(false);
    setSubmitError(null);
    setStep({ name: 'entry' });
  }

  const reader = useReceiptReader((read) => applyReceipt(read, captureFrom));
  const pendingReceipts = usePendingReceipts(
    step.name === 'kind' && data.status === 'ready',
  );

  React.useEffect(() => {
    onLockChange(
      busy !== null ||
        attachment.state.status === 'uploading' ||
        reader.state.phase === 'uploading',
    );
  }, [busy, attachment.state.status, reader.state.phase, onLockChange]);

  const finish = (title: string, description?: string) => {
    toast.success(title, description ? { description } : undefined);
    onDone();
  };

  function pickKind(kind: EntryKind) {
    setSubmitError(null);
    setReceipt(null);
    setCheck([]);
    const only = onlyAccount;
    if (kind === 'transfer') {
      setTransfer(emptyTransferDraft(todayKey()));
      setTransferTried(false);
      setStep({ name: 'transfer' });
    } else {
      setEntry({ ...emptyEntryDraft(kind, todayKey()), accountId: only });
      setEntryTried(false);
      setStep({ name: 'entry' });
    }
  }

  async function startUpload(transactionId: string, created: boolean) {
    if (!file) return;
    setStep({ name: 'upload', transactionId, created });
    const ok = await attachment.upload(transactionId, file);
    if (!ok) return;
    router.refresh();
    if (created) {
      finish(
        t(`newEntry.toasts.${entry.type}`),
        t('newEntry.toasts.withAttachment'),
      );
    } else {
      finish(t('newEntry.toasts.attached'));
    }
  }

  async function createEntry(payload: CreateTransactionPayload) {
    setBusy('saving');
    setSubmitError(null);
    try {
      const { createTransaction } = await gql<{
        createTransaction: { id: string };
      }>(CREATE_TRANSACTION_MUTATION, { input: payload });
      router.refresh();
      setBusy(null);
      if (file) {
        await startUpload(createTransaction.id, true);
      } else {
        finish(t(`newEntry.toasts.${payload.type}`));
      }
    } catch (error) {
      setBusy(null);
      setSubmitError(t(`newEntry.errors.${createErrorKey(error)}`));
    }
  }

  function startCapture(from: 'kind' | 'entry') {
    setCaptureFrom(from);
    setPhoto(null);
    setSubmitError(null);
    reader.reset();
    setStep({ name: 'receipt' });
  }

  function pickPhoto(next: File) {
    setPhoto(next);
    void reader.read(next);
  }

  /** Leave the capture (cancel, back): the import, if any, is discarded. */
  function cancelCapture() {
    const leftover = leftoverReceiptId(reader.state);
    if (leftover) discardQuietly(leftover);
    reader.reset();
    setStep(captureFrom === 'entry' ? { name: 'entry' } : { name: 'kind' });
  }

  function captureAnotherPhoto() {
    const leftover = leftoverReceiptId(reader.state);
    if (leftover) discardQuietly(leftover);
    setPhoto(null);
    reader.reset();
  }

  /**
   * "Capturar a mano": the receipt couldn't be read, so the import is
   * discarded and the photo (if it went up fine) becomes a normal
   * attachment of the expense.
   */
  function captureByHand() {
    const state = reader.state;
    const leftover = leftoverReceiptId(state);
    if (leftover) discardQuietly(leftover);
    const photoUploaded = state.phase === 'failed' && state.receiptId !== null;
    setFile(photoUploaded ? photo : null);
    reader.reset();
    if (captureFrom !== 'entry' || entry.type !== 'expense') {
      setEntry(freshExpense());
    }
    setReceipt(null);
    setCheck([]);
    setEntryTried(false);
    setSubmitError(null);
    setStep({ name: 'entry' });
  }

  async function discardReceipt() {
    if (!receipt) return;
    setBusy('saving');
    try {
      await gql(DISCARD_RECEIPT_MUTATION, { id: receipt.id });
      setReceipt(null);
      setCheck([]);
      toast.success(t('receipts.toasts.discarded'));
    } catch {
      toast.error(t('receipts.errors.discardFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function confirmReceipt(attachToTransactionId?: string) {
    if (!receipt) return;
    setBusy('saving');
    setSubmitError(null);
    try {
      await gql(CONFIRM_RECEIPT_MUTATION, {
        id: receipt.id,
        input: buildConfirmInput(entry, attachToTransactionId),
      });
      router.refresh();
      setBusy(null);
      if (attachToTransactionId) {
        finish(t('receipts.toasts.attached'));
      } else {
        finish(t('newEntry.toasts.expense'), t('receipts.toasts.created'));
      }
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

    const payload = buildTransactionInput(entry, account);
    setPending(payload);
    setBusy('checking');
    let matches: SimilarTransaction[] = [];
    try {
      ({ similarTransactions: matches } = await gql<{
        similarTransactions: SimilarTransaction[];
      }>(SIMILAR_TRANSACTIONS_QUERY, similarTransactionsArgs(payload)));
    } catch {
      // The duplicate check is a convenience: if it fails, create anyway
      // (a real problem, e.g. no connection, shows up on create).
    }
    if (receipt) {
      const candidates = receiptMatches(receipt, matches);
      if (candidates.length > 0) {
        setBusy(null);
        setStep({ name: 'receiptMatch', matches: candidates });
        return;
      }
      await confirmReceipt();
      return;
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
    const plan = planForDuplicateAnswer(answer, file !== null);
    if (plan.kind === 'create') {
      if (pending) void createEntry(pending);
    } else if (plan.kind === 'attachToExisting') {
      void startUpload(plan.transactionId, false);
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
        { account: accountLabel(to) },
      ),
    );
    setBusy('saving');
    try {
      await gql(CREATE_TRANSFER_MUTATION, { input });
      router.refresh();
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

  function goBack() {
    setSubmitError(null);
    if (step.name === 'duplicates' || step.name === 'receiptMatch') {
      setStep({ name: 'entry' });
    } else if (step.name === 'receipt') {
      cancelCapture();
    } else {
      // A read receipt stays pending (listed on the first step).
      setReceipt(null);
      setCheck([]);
      setStep({ name: 'kind' });
    }
  }

  const title = (() => {
    switch (step.name) {
      case 'kind':
        return t('newEntry.title');
      case 'entry':
        return t(`newEntry.titles.${entry.type}`);
      case 'transfer':
        return isCardPayment(accounts, transfer.toAccountId)
          ? t('newEntry.titles.cardPayment')
          : t('newEntry.titles.transfer');
      case 'duplicates':
      case 'receiptMatch':
        return t('newEntry.titles.duplicates');
      case 'receipt':
        if (reader.state.phase === 'reading') {
          return t('receipts.titles.reading');
        }
        return reader.state.phase === 'failed' &&
          reader.state.receiptId &&
          reader.state.reason !== 'alreadyConfirmed'
          ? t('receipts.titles.failed')
          : t('receipts.titles.capture');
      case 'upload':
        return t('newEntry.titles.upload');
    }
  })();
  const canGoBack =
    step.name !== 'kind' &&
    step.name !== 'upload' &&
    busy === null &&
    reader.state.phase !== 'uploading';
  const busyLabel =
    busy === 'checking' ? t('newEntry.checking') : t('newEntry.saving');

  let body: React.ReactNode;
  if (data.status === 'loading') {
    body = (
      <p className="py-8 text-center text-sm text-on-surface-variant">
        {t('common.loading')}
      </p>
    );
  } else if (data.status === 'error') {
    body = (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p role="alert" className="text-sm text-expense">
          {t('newEntry.errors.loadFailed')}
        </p>
        <Button type="button" variant="outline" onClick={reload}>
          {t('common.retry')}
        </Button>
      </div>
    );
  } else if (accounts.length === 0) {
    body = (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-base font-medium text-on-background">
          {t('newEntry.noAccounts.title')}
        </p>
        <p className="text-sm text-on-surface-variant">
          {t('newEntry.noAccounts.description')}
        </p>
        <Button asChild variant="secondary">
          <Link href="/settings/banks" onClick={onDone}>
            {t('common.connectBank')}
          </Link>
        </Button>
      </div>
    );
  } else if (step.name === 'kind') {
    body = (
      <div className="flex flex-col gap-4">
        <EntryKindPicker onPick={pickKind} />
        <ScanReceiptButton
          variant="shortcut"
          onClick={() => startCapture('kind')}
        />
        <PendingReceipts
          receipts={pendingReceipts}
          onResume={(read) => {
            setCaptureFrom('kind');
            applyReceipt(read, 'kind');
          }}
        />
      </div>
    );
  } else if (step.name === 'entry') {
    body = (
      <EntryForm
        draft={entry}
        onChange={setEntry}
        accounts={accounts}
        categories={categories}
        errors={entryErrors}
        file={file}
        onFileChange={setFile}
        busy={busy !== null}
        busyLabel={busyLabel}
        submitError={submitError}
        onSubmit={() => void submitEntry()}
        receiptSlot={
          entry.type !== 'expense' ? undefined : receipt ? (
            <ReceiptSummary
              receipt={receipt}
              needsCheck={check.length > 0}
              busy={busy !== null}
              onDiscard={() => void discardReceipt()}
            />
          ) : (
            <ScanReceiptButton
              variant="inline"
              onClick={() => startCapture('entry')}
            />
          )
        }
        check={receipt ? check : []}
        showAttachment={!receipt}
      />
    );
  } else if (step.name === 'receipt') {
    const state = reader.state;
    if (state.phase === 'reading' || state.phase === 'ready') {
      body = <ReceiptReading onCancel={cancelCapture} />;
    } else if (state.phase === 'failed' && state.receiptId !== null) {
      body = (
        <ReceiptReadFailed
          reason={
            state.reason as
              | 'readFailed'
              | 'timeout'
              | 'discarded'
              | 'alreadyConfirmed'
          }
          onManual={captureByHand}
          onOtherPhoto={captureAnotherPhoto}
          onKeepWaiting={reader.keepWaiting}
          onClose={onDone}
        />
      );
    } else {
      body = (
        <ReceiptCapture
          state={state}
          file={photo}
          onPick={pickPhoto}
          onManual={captureByHand}
        />
      );
    }
  } else if (step.name === 'receiptMatch') {
    body = (
      <ReceiptMatchReview
        matches={step.matches}
        busy={busy !== null}
        error={submitError}
        onAttach={(transactionId) => void confirmReceipt(transactionId)}
        onCreateNew={() => void confirmReceipt()}
      />
    );
  } else if (step.name === 'transfer') {
    body =
      transferSources(accounts).length === 0 || accounts.length < 2 ? (
        <p className="py-4 text-sm text-on-surface-variant">
          {t('newEntry.noTransferAccounts')}
        </p>
      ) : (
        <TransferForm
          draft={transfer}
          onChange={setTransfer}
          accounts={accounts}
          errors={
            transferTried ? validateTransfer(transfer, accounts, today) : {}
          }
          busy={busy !== null}
          busyLabel={busyLabel}
          submitError={submitError}
          onSubmit={() => void submitTransfer()}
        />
      );
  } else if (step.name === 'duplicates') {
    body = (
      <DuplicateReview
        matches={step.matches}
        hasAttachment={file !== null}
        busy={busy !== null}
        error={submitError}
        onIsThis={(transactionId) =>
          answerDuplicate({ kind: 'isThis', transactionId })
        }
        onCreateAnyway={() => answerDuplicate({ kind: 'createAnyway' })}
      />
    );
  } else {
    const target = step;
    body = (
      <AttachmentUploadStatus
        fileName={file?.name ?? ''}
        state={attachment.state}
        showCreated={target.created}
        onRetry={() => void startUpload(target.transactionId, target.created)}
        onSkip={() =>
          target.created
            ? finish(
                t(`newEntry.toasts.${entry.type}`),
                t('newEntry.toasts.withoutAttachment'),
              )
            : onDone()
        }
      />
    );
  }

  return (
    <>
      <div className="flex items-start gap-2 pr-12">
        {canGoBack ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={goBack}
            aria-label={t('newEntry.back')}
            className="-ml-2 shrink-0"
          >
            <ArrowLeft aria-hidden className="size-5" />
          </Button>
        ) : null}
        <div className="min-w-0 pt-1.5">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription
            className={step.name === 'kind' ? undefined : 'sr-only'}
          >
            {t('newEntry.description')}
          </SheetDescription>
        </div>
      </div>
      {body}
    </>
  );
}
