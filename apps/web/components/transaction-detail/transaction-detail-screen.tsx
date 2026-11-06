'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowLeftRight,
  CheckCheck,
  PencilLine,
  Trash2,
  Undo2,
} from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { toast } from '@finnit/ui/components/ui/toaster';

import {
  ConfirmDialog,
  type ConfirmRequest,
} from '@/components/admin/confirm-dialog';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import {
  deleteTransaction,
  transactionErrorMessage,
  updateTransaction,
} from '@/lib/transaction-detail/api';
import type { TransactionDetailData } from '@/lib/transaction-detail/load';
import { UNDO_TRANSFER_CONVERSION_MUTATION } from '@finnit/core/transfers/convert';
import { ConvertTransferDialog } from '@/components/transfers/convert-transfer-dialog';
import { AttachmentsCard } from './attachments-card';
import { useDetailHost } from './detail-host';
import { TransactionEditDialog } from './transaction-edit-dialog';
import { TransactionFacts } from './transaction-facts';
import { TransactionSummary } from './transaction-summary';

/** One movement (in the drawer or modal): its data, edits, files and deletion. */
export function TransactionDetailScreen({
  data,
}: {
  data: TransactionDetailData;
}) {
  const host = useDetailHost();
  const { t } = useLocalizer();
  const tt = useTranslations('transaction');
  const tx = useTranslations('transfers');
  const { view } = data;
  const [dialog, setDialog] = React.useState<'edit' | 'convert' | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [applying, setApplying] = React.useState(false);

  /** "Marcar como aplicado": the bank already applied it. */
  function markApplied() {
    setApplying(true);
    updateTransaction(view.id, { inProcess: false }, gql)
      .then(() => {
        toast.success(tt('markedApplied'));
        host.refresh();
      })
      .catch((error: unknown) => {
        toast.error(transactionErrorMessage(error, t));
      })
      .finally(() => setApplying(false));
  }

  /** "Deshacer transferencia": back to expense and income. */
  function askUndo(transferId: string) {
    setConfirm({
      title: tx('undo.title'),
      description: tx('undo.description'),
      confirmLabel: tx('undo.confirm'),
      onConfirm: () => {
        setConfirm(null);
        setApplying(true);
        gql(UNDO_TRANSFER_CONVERSION_MUTATION, { transferId })
          .then(() => {
            toast.success(tx('undo.done'));
            host.refresh();
          })
          .catch((error: unknown) => {
            toast.error(transactionErrorMessage(error, t));
          })
          .finally(() => setApplying(false));
      },
    });
  }

  function askDelete() {
    setConfirm({
      title: tt('deleteTitle'),
      description: tt('deleteDescription', { account: view.accountLabel }),
      confirmLabel: tt('delete'),
      destructive: true,
      onConfirm: () => {
        setConfirm(null);
        setDeleting(true);
        deleteTransaction(view.id, gql)
          .then(() => {
            toast.success(tt('toasts.deleted'));
            host.close({ deleted: true });
          })
          .catch((error: unknown) => {
            toast.error(transactionErrorMessage(error, t));
            setDeleting(false);
          });
      },
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <TransactionSummary view={view} />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setDialog('edit')}>
          <PencilLine aria-hidden /> {tt('edit')}
        </Button>
        {view.convertSource ? (
          <Button variant="outline" onClick={() => setDialog('convert')}>
            <ArrowLeftRight aria-hidden /> {tx('convert.action')}
          </Button>
        ) : null}
        {view.counterpart?.converted ? (
          <Button
            variant="outline"
            onClick={() => askUndo(view.counterpart!.transferId)}
            disabled={applying}
          >
            <Undo2 aria-hidden /> {tx('undo.action')}
          </Button>
        ) : null}
        {view.inProcess ? (
          <Button variant="outline" onClick={markApplied} disabled={applying}>
            <CheckCheck aria-hidden /> {tt('markApplied')}
          </Button>
        ) : null}
        {view.deleteBlock === null ? (
          <Button variant="destructive" onClick={askDelete} disabled={deleting}>
            <Trash2 aria-hidden /> {tt('delete')}
          </Button>
        ) : null}
      </div>
      {view.deleteBlock ? (
        <p className="-mt-2 text-xs text-on-surface-variant">
          {tt(`deleteBlocked.${view.deleteBlock}`)}
        </p>
      ) : null}

      <div className="grid gap-5 @3xl:grid-cols-2">
        <TransactionFacts
          view={view}
          merchant={data.form.merchantName}
          description={data.form.description}
          onOpenTransaction={host.show}
        />
        <AttachmentsCard
          transactionId={view.id}
          attachments={view.attachments}
        />
      </div>

      {dialog === 'edit' ? (
        <TransactionEditDialog
          transactionId={view.id}
          initial={data.form}
          rules={view.rules}
          subject={view.name}
          currency={data.currency}
          categories={data.categories}
          categoryKind={data.categoryKind}
          isTransfer={view.counterpart !== null}
          onClose={() => setDialog(null)}
          onSaved={({ changed, rule }) => {
            setDialog(null);
            if (!changed) {
              toast(tt('toasts.noChanges'));
              return;
            }
            toast.success(tt(rule ? 'toasts.ruleCreated' : 'toasts.saved'));
            host.refresh();
          }}
        />
      ) : null}
      {dialog === 'convert' && view.convertSource ? (
        <ConvertTransferDialog
          source={view.convertSource}
          onClose={() => setDialog(null)}
          onConverted={() => {
            setDialog(null);
            toast.success(tx('convert.done'));
            host.refresh();
          }}
        />
      ) : null}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
