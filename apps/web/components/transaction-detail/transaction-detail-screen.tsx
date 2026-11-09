'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowLeftRight,
  CalendarClock,
  CheckCheck,
  CopyCheck,
  Landmark,
  MoreHorizontal,
  PencilLine,
  Repeat,
  Trash2,
  Undo2,
  Unlink,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@finnit/ui/components/ui/dropdown-menu';
import { cn } from '@finnit/ui/lib/utils';
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
} from '@finnit/core/transaction-detail/api';
import type { TransactionDetailData } from '@/lib/transaction-detail/load';
import { UNDO_TRANSFER_CONVERSION_MUTATION } from '@finnit/core/transfers/convert';
import { ConvertTransferDialog } from '@/components/transfers/convert-transfer-dialog';
import { MergeDuplicateDialog } from '@/components/duplicates/merge-duplicate-dialog';
import { LinkLoanDialog } from '@/components/loan-links/link-loan-dialog';
import { UnlinkLoanDialog } from '@/components/loan-links/unlink-loan-dialog';
import { LinkRecurringDialog } from '@/components/recurring-links/link-recurring-dialog';
import { LinkCardInstallmentDialog } from '@/components/card-installments/link-card-installment-dialog';
import { NewDebtDialog } from '@/components/debts/new-debt-dialog';
import { cardInstallmentPrefill } from '@finnit/core/debts/card-installment-links';
import { runPaymentAction } from '@finnit/core/recurring/api';
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
  const tl = useTranslations('debts.links');
  const { view } = data;
  const [dialog, setDialog] = React.useState<
    | 'edit'
    | 'convert'
    | 'linkLoan'
    | 'unlinkLoan'
    | 'linkRecurring'
    | 'linkCardInstallment'
    | 'newCardInstallment'
    | 'merge'
    | null
  >(null);
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

  /** "Desligar del gasto recurrente": its payment is pending again. */
  function askUnlinkRecurring(occurrenceId: string) {
    setConfirm({
      title: tt('unlinkRecurring.title'),
      description: tt('unlinkRecurring.description'),
      confirmLabel: tt('unlinkRecurring.confirm'),
      onConfirm: () => {
        setConfirm(null);
        setApplying(true);
        runPaymentAction('reopen', occurrenceId, gql)
          .then(() => {
            toast.success(tt('unlinkRecurring.done'));
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
      description: [
        tt('deleteDescription', { account: view.accountLabel }),
        ...view.deleteNotes,
      ].join(' '),
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

  const recurringLink = view.recurring;
  const actions: {
    key: string;
    label: string;
    icon: LucideIcon;
    run: () => void;
    disabled?: boolean;
    destructive?: boolean;
  }[] = [
    ...(view.convertSource
      ? [
          {
            key: 'convert',
            label: tx('convert.action'),
            icon: ArrowLeftRight,
            run: () => setDialog('convert'),
          },
        ]
      : []),
    ...(view.counterpart?.converted
      ? [
          {
            key: 'undo',
            label: tx('undo.action'),
            icon: Undo2,
            run: () => askUndo(view.counterpart!.transferId),
            disabled: applying,
          },
        ]
      : []),
    ...(view.canLinkRecurring
      ? [
          {
            key: 'linkRecurring',
            label: tt('linkRecurring.action'),
            icon: Repeat,
            run: () => setDialog('linkRecurring'),
          },
        ]
      : []),
    ...(recurringLink
      ? [
          {
            key: 'unlinkRecurring',
            label: tt('unlinkRecurring.action'),
            icon: Unlink,
            run: () => askUnlinkRecurring(recurringLink.occurrenceId),
            disabled: applying,
          },
        ]
      : []),
    ...(view.canLinkCardInstallment
      ? [
          {
            key: 'linkCardInstallment',
            label: tt('linkCardInstallment.action'),
            icon: CalendarClock,
            run: () => setDialog('linkCardInstallment'),
          },
        ]
      : []),
    ...(view.canLinkLoan
      ? [
          {
            key: 'linkLoan',
            label: tl('linkAction'),
            icon: Landmark,
            run: () => setDialog('linkLoan'),
          },
        ]
      : []),
    ...(view.loan?.occurrenceId
      ? [
          {
            key: 'unlinkLoan',
            label: tl('unlink.action'),
            icon: Unlink,
            run: () => setDialog('unlinkLoan'),
          },
        ]
      : []),
    ...(view.mergeable
      ? [
          {
            key: 'merge',
            label: tt('markDuplicate'),
            icon: CopyCheck,
            run: () => setDialog('merge'),
          },
        ]
      : []),
    ...(view.deleteBlock === null
      ? [
          {
            key: 'delete',
            label: tt('delete'),
            icon: Trash2,
            run: askDelete,
            disabled: deleting,
            destructive: true,
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <TransactionSummary view={view} />

      {/*
        "Editar" first; every other action in the "⋯" menu (deleting last,
        in red), so the row doesn't grow with each one a movement allows.
      */}
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => setDialog('edit')}>
          <PencilLine aria-hidden /> {tt('edit')}
        </Button>
        {view.inProcess ? (
          <Button variant="outline" onClick={markApplied} disabled={applying}>
            <CheckCheck aria-hidden /> {tt('markApplied')}
          </Button>
        ) : null}
        {actions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                aria-label={tt('moreActions')}
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-60">
              {actions.map((action, index) => (
                <React.Fragment key={action.key}>
                  {action.destructive && index > 0 ? (
                    <DropdownMenuSeparator />
                  ) : null}
                  <DropdownMenuItem
                    disabled={action.disabled}
                    onSelect={action.run}
                    className={cn(
                      action.destructive &&
                        'text-expense focus:text-expense [&_svg]:!text-expense',
                    )}
                  >
                    <action.icon aria-hidden /> {action.label}
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
      {dialog === 'linkLoan' ? (
        <LinkLoanDialog
          transactionId={view.id}
          amountLabel={view.amount}
          onClose={() => setDialog(null)}
          onLinked={(name) => {
            setDialog(null);
            toast.success(tl('done', { name }));
            host.refresh();
          }}
        />
      ) : null}
      {dialog === 'linkRecurring' ? (
        <LinkRecurringDialog
          transaction={data.transaction}
          onClose={() => setDialog(null)}
          onLinked={(name) => {
            setDialog(null);
            toast.success(tt('linkRecurring.done', { name }));
            host.refresh();
          }}
        />
      ) : null}
      {dialog === 'linkCardInstallment' ? (
        <LinkCardInstallmentDialog
          transaction={data.transaction}
          onClose={() => setDialog(null)}
          onChanged={(message) => {
            setDialog(null);
            toast.success(message);
            host.refresh();
          }}
          onCreate={() => setDialog('newCardInstallment')}
        />
      ) : null}
      {dialog === 'newCardInstallment' ? (
        <NewDebtDialog
          initialKind="card_installments"
          cardPrefill={cardInstallmentPrefill({
            id: data.transaction.id,
            accountId: data.transaction.accountId,
            amount: data.transaction.amount,
            txnDate: data.transaction.txnDate,
            name: view.title,
          })}
          today={data.today}
          onClose={() => setDialog(null)}
          onSaved={(_id, name) => {
            setDialog(null);
            toast.success(t('debts.toasts.created', { name }));
            host.refresh();
          }}
        />
      ) : null}
      {dialog === 'unlinkLoan' && view.loan?.occurrenceId ? (
        <UnlinkLoanDialog
          occurrenceId={view.loan.occurrenceId}
          onClose={() => setDialog(null)}
          onUnlinked={() => {
            setDialog(null);
            toast.success(tl('unlink.done'));
            host.refresh();
          }}
        />
      ) : null}
      {dialog === 'merge' ? (
        <MergeDuplicateDialog
          transaction={data.transaction}
          onClose={() => setDialog(null)}
          onMerged={(keptId) => {
            setDialog(null);
            toast.success(t('duplicates.toasts.merged'));
            // This one may be the copy that went: show the one that stays.
            if (keptId === view.id) host.refresh();
            else host.show(keptId);
          }}
        />
      ) : null}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
