'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, PencilLine, Tag, Trash2 } from 'lucide-react';

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
} from '@/lib/transaction-detail/api';
import type { TransactionDetailData } from '@/lib/transaction-detail/load';
import { canEditAnything } from '@/lib/transaction-detail/view';
import { AttachmentsCard } from './attachments-card';
import { EditTransactionDialog } from './edit-transaction-dialog';
import { TransactionAliasDialog } from './transaction-alias-dialog';
import { TransactionFacts } from './transaction-facts';
import { TransactionSummary } from './transaction-summary';

/** /transactions/[id]: one movement, its edits, alias, files and deletion. */
export function TransactionDetailScreen({
  data,
}: {
  data: TransactionDetailData;
}) {
  const router = useRouter();
  const { t } = useLocalizer();
  const tt = useTranslations('transaction');
  const { view } = data;
  const [dialog, setDialog] = React.useState<'edit' | 'alias' | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push('/history');
  };

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
            router.replace('/history');
            router.refresh();
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
      <Button variant="ghost" size="sm" className="self-start" onClick={back}>
        <ArrowLeft aria-hidden /> {tt('back')}
      </Button>

      <TransactionSummary view={view} />

      <div className="flex flex-wrap gap-2">
        {canEditAnything(view.rules) ? (
          <Button variant="outline" onClick={() => setDialog('edit')}>
            <PencilLine aria-hidden /> {tt('edit')}
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => setDialog('alias')}>
          <Tag aria-hidden /> {tt('rename')}
        </Button>
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

      <div className="grid gap-5 lg:grid-cols-2">
        <TransactionFacts
          view={view}
          merchant={data.form.merchantName}
          description={data.form.description}
        />
        <AttachmentsCard
          transactionId={view.id}
          attachments={view.attachments}
        />
      </div>

      {dialog === 'edit' ? (
        <EditTransactionDialog
          transactionId={view.id}
          initial={data.form}
          rules={view.rules}
          currency={data.currency}
          categories={data.categories}
          categoryKind={data.categoryKind}
          isTransfer={view.counterpart !== null}
          onClose={() => setDialog(null)}
          onSaved={(changed) => {
            setDialog(null);
            if (!changed) {
              toast(tt('toasts.noChanges'));
              return;
            }
            toast.success(tt('toasts.saved'));
            router.refresh();
          }}
        />
      ) : null}
      {dialog === 'alias' ? (
        <TransactionAliasDialog
          transactionId={view.id}
          current={{
            displayName: view.title,
            hasOwnAlias: view.hasOwnAlias,
            isPrivate: view.isPrivate,
          }}
          original={view.original}
          onClose={() => setDialog(null)}
          onSaved={(removed) => {
            setDialog(null);
            toast.success(
              removed ? tt('toasts.nameRemoved') : tt('toasts.renamed'),
            );
            router.refresh();
          }}
        />
      ) : null}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
