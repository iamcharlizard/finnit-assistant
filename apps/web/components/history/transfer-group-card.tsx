'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronRight,
  Trash2,
  type LucideIcon,
} from 'lucide-react';

import { toast } from '@finnit/ui/components/ui/toaster';
import { cn } from '@finnit/ui/lib/utils';

import {
  ConfirmDialog,
  type ConfirmRequest,
} from '@/components/admin/confirm-dialog';
import { useTransactionDrawer } from '@/components/transaction-detail/transaction-drawer';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import {
  deleteTransfer,
  transactionErrorMessage,
} from '@finnit/core/transaction-detail/api';
import type { HistoryRow, TransferGroup } from '@finnit/core/history/view';

const STATUS_COLOR: Record<HistoryRow['status'], string> = {
  completed: 'text-income',
  pending: 'text-on-surface-variant',
  inProcess: 'text-on-surface-variant',
};

/**
 * Both sides of a transfer as one movement: what moved and from which
 * account to which, with each side below as a sub-movement that opens its
 * own detail.
 */
export function TransferGroupCard({
  group,
  onDetailChange,
}: {
  group: TransferGroup;
  onDetailChange?: () => void;
}) {
  const t = useTranslations();
  const l = useLocalizer();
  const router = useRouter();
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  function askDelete() {
    setConfirm({
      title: t('history.deleteTransferTitle'),
      description: t('history.deleteTransferDescription'),
      confirmLabel: t('history.deleteTransfer'),
      destructive: true,
      onConfirm: () => {
        setConfirm(null);
        setDeleting(true);
        deleteTransfer(group.transferId, gql)
          .then(() => {
            toast.success(t('history.transferDeleted'));
            onDetailChange?.();
            router.refresh();
          })
          .catch((error: unknown) => {
            toast.error(transactionErrorMessage(error, l.t));
          })
          .finally(() => setDeleting(false));
      },
    });
  }

  const status =
    group.status === 'pending'
      ? t('finance.pending')
      : group.status === 'inProcess'
        ? t('finance.inProcess')
        : t('finance.completed');
  return (
    <div
      role="group"
      aria-label={`${group.title}: ${group.route}`}
      className="flex flex-col rounded-2xl bg-surface"
    >
      <div className="flex min-h-11 items-center gap-3 p-4 pb-2">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-chip bg-track">
          <ArrowLeftRight
            aria-hidden
            className="size-[22px] text-on-surface-variant"
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-on-background">
            {group.title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-on-surface-variant">
            {group.route}
          </span>
        </span>
        <span className="ml-2 flex shrink-0 flex-col items-end">
          <span className="text-sm font-bold text-on-background">
            {group.amount}
          </span>
          <span
            className={cn('mt-0.5 text-[11px]', STATUS_COLOR[group.status])}
          >
            {status}
          </span>
        </span>
        <button
          type="button"
          onClick={askDelete}
          disabled={deleting}
          aria-label={t('history.deleteTransfer')}
          title={t('history.deleteTransfer')}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant outline-none transition-colors hover:bg-expense/10 hover:text-expense focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-40"
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      </div>
      <ul
        aria-label={t('history.transfer.sides')}
        className="relative ml-10 flex flex-col pr-2 pb-2 before:absolute before:top-0 before:bottom-5 before:left-0 before:w-px before:bg-outline"
      >
        <SideRow
          icon={ArrowUpRight}
          label={group.outLabel}
          row={group.out}
          onDetailChange={onDetailChange}
        />
        <SideRow
          icon={ArrowDownLeft}
          label={group.inLabel}
          row={group.in}
          onDetailChange={onDetailChange}
        />
      </ul>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function SideRow({
  icon: Icon,
  label,
  row,
  onDetailChange,
}: {
  icon: LucideIcon;
  label: string;
  row: HistoryRow;
  onDetailChange?: () => void;
}) {
  const t = useTranslations();
  const drawer = useTransactionDrawer();
  return (
    <li className="relative pl-4 before:absolute before:top-1/2 before:left-0 before:h-px before:w-3 before:bg-outline">
      <button
        type="button"
        onClick={() => drawer.open(row.id, { onChange: onDetailChange })}
        aria-label={t('transaction.openDetail', { name: label })}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Icon aria-hidden className="size-4 shrink-0 text-on-surface-variant" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] text-on-background">
            {label}
          </span>
          {row.title && row.title !== label ? (
            <span className="truncate text-[11px] text-on-surface-variant">
              {row.title}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            'shrink-0 text-[13px] font-medium tabular-nums',
            row.variant === 'income'
              ? 'text-income'
              : 'text-on-surface-variant',
          )}
        >
          {row.amount}
        </span>
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-on-surface-variant"
        />
      </button>
    </li>
  );
}
