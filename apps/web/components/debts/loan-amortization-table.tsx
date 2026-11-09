'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CalendarClock, Link2, Pencil, Receipt, Unlink } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import { DataTable, type ColumnDef } from '@finnit/ui/components/ui/data-table';

import { useTableLabels } from '@/components/use-table-labels';
import type {
  ScheduleRow,
  ScheduleRowStatus,
} from '@finnit/core/debts/detail-view';

const STATUS_BADGE: Record<
  ScheduleRowStatus,
  'income' | 'muted' | 'expense' | 'outline' | 'highlight'
> = {
  paid: 'income',
  historical: 'muted',
  upcoming: 'outline',
  overdue: 'expense',
  skipped: 'muted',
  projected: 'highlight',
};

const right = { align: 'right' } as const;
const dash = (label: string | null) => label ?? '—';

/**
 * Every payment of the loan (paid, open and projected): amount and, for
 * loans given by their rate, how much is principal, interest, VAT and fee,
 * with the balance left; for loans scheduled by their charges, which
 * installment of which charge it is. Five per page by default; sortable by
 * number and date. Open payments can be paid from here; one paid without
 * a movement can take an expense, and one paid by an expense opens it or
 * unlinks it.
 */
export function LoanAmortizationTable({
  rows,
  hasBreakdown,
  hasFees,
  onPay,
  onReschedule,
  onLinkExpense,
  onUnlink,
  onOpenMovement,
  onEditInstallment,
}: {
  rows: ScheduleRow[];
  hasBreakdown: boolean;
  hasFees: boolean;
  onPay: (row: ScheduleRow) => void;
  /** Moves an open payment to another day. */
  onReschedule: (row: ScheduleRow) => void;
  /** A payment paid without a movement takes an existing expense. */
  onLinkExpense: (row: ScheduleRow) => void;
  /** Takes the expense off a payment. */
  onUnlink: (row: ScheduleRow) => void;
  onOpenMovement: (transactionId: string) => void;
  /** Card purchases: changes an installment's day and amount. */
  onEditInstallment?: (row: ScheduleRow) => void;
}) {
  const td = useTranslations('debts.detail');
  const tl = useTranslations('debts.links');
  const labels = useTableLabels();

  const hasConcept = rows.some((row) => row.concept);

  const columns = React.useMemo<ColumnDef<ScheduleRow>[]>(() => {
    const concept: ColumnDef<ScheduleRow>[] = hasConcept
      ? [
          {
            id: 'concept',
            header: td('columns.concept'),
            cell: ({ row }) => (
              <span className="block max-w-64 truncate tabular-nums">
                {dash(row.original.concept)}
              </span>
            ),
          },
        ]
      : [];
    const breakdown: ColumnDef<ScheduleRow>[] = hasBreakdown
      ? [
          {
            id: 'principal',
            header: td('columns.principal'),
            cell: ({ row }) => dash(row.original.principalLabel),
            meta: right,
          },
          {
            id: 'interest',
            header: td('columns.interest'),
            cell: ({ row }) => dash(row.original.interestLabel),
            meta: right,
          },
          {
            id: 'vat',
            header: td('columns.vat'),
            cell: ({ row }) => dash(row.original.vatLabel),
            meta: right,
          },
        ]
      : [];
    const fee: ColumnDef<ScheduleRow>[] = hasFees
      ? [
          {
            id: 'fee',
            header: td('columns.fee'),
            cell: ({ row }) => dash(row.original.feeLabel),
            meta: right,
          },
        ]
      : [];
    return [
      {
        accessorKey: 'number',
        header: td('columns.number'),
        enableSorting: true,
        meta: { ...right, cellClassName: 'text-on-surface-variant' },
      },
      {
        accessorKey: 'dueDate',
        header: td('columns.date'),
        enableSorting: true,
        sortingFn: 'text',
        cell: ({ row }) =>
          row.original.originalDateLabel ? (
            <span className="flex flex-col leading-tight">
              <span>{row.original.dateLabel}</span>
              <span className="text-xs text-on-surface-variant">
                {td('movedFrom', { date: row.original.originalDateLabel })}
              </span>
            </span>
          ) : (
            row.original.dateLabel
          ),
        meta: { cellClassName: 'whitespace-nowrap' },
      },
      ...concept,
      {
        id: 'amount',
        header: td('columns.payment'),
        cell: ({ row }) => row.original.amountLabel,
        meta: { ...right, cellClassName: 'font-medium' },
      },
      ...breakdown,
      ...fee,
      {
        id: 'balance',
        header: td('columns.balance'),
        cell: ({ row }) => row.original.balanceLabel,
        meta: right,
      },
      {
        id: 'status',
        header: td('columns.status'),
        cell: ({ row }) => (
          <Badge variant={STATUS_BADGE[row.original.status]}>
            {td(`status.${row.original.status}`)}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{td('columns.actions')}</span>,
        cell: ({ row }) => {
          const r = row.original;
          const edit =
            r.editOccurrenceId && onEditInstallment ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={td('editInstallment.action')}
                title={td('editInstallment.action')}
                onClick={() => onEditInstallment(r)}
              >
                <Pencil aria-hidden />
              </Button>
            ) : null;
          // A card purchase's installment is billed by the card: it is
          // edited, or linked to its charge, not paid from here.
          if (r.editOccurrenceId) {
            return (
              <span className="flex items-center justify-end gap-1">
                {edit}
                {r.unlinkOccurrenceId && r.transactionId ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={tl('viewMovement')}
                      title={tl('viewMovement')}
                      onClick={() => onOpenMovement(r.transactionId!)}
                    >
                      <Receipt aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={tl('unlink.action')}
                      title={tl('unlink.action')}
                      onClick={() => onUnlink(r)}
                    >
                      <Unlink aria-hidden />
                    </Button>
                  </>
                ) : r.linkOccurrenceId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-8 py-1"
                    onClick={() => onLinkExpense(r)}
                  >
                    <Link2 aria-hidden /> {tl('linkPaid')}
                  </Button>
                ) : null}
              </span>
            );
          }
          if (r.occurrenceId) {
            return (
              <span className="flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={td('reschedule')}
                  title={td('reschedule')}
                  onClick={() => onReschedule(row.original)}
                >
                  <CalendarClock aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-8 py-1"
                  onClick={() => onPay(row.original)}
                >
                  {td('payThis')}
                </Button>
              </span>
            );
          }
          if (r.unlinkOccurrenceId && r.transactionId) {
            const transactionId = r.transactionId;
            return (
              <span className="flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={tl('viewMovement')}
                  title={tl('viewMovement')}
                  onClick={() => onOpenMovement(transactionId)}
                >
                  <Receipt aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={tl('unlink.action')}
                  title={tl('unlink.action')}
                  onClick={() => onUnlink(r)}
                >
                  <Unlink aria-hidden />
                </Button>
              </span>
            );
          }
          if (r.linkOccurrenceId) {
            return (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-8 py-1"
                onClick={() => onLinkExpense(r)}
              >
                <Link2 aria-hidden /> {tl('linkPaid')}
              </Button>
            );
          }
          return null;
        },
        meta: right,
      },
    ];
  }, [
    hasBreakdown,
    hasConcept,
    hasFees,
    onPay,
    onReschedule,
    onLinkExpense,
    onUnlink,
    onOpenMovement,
    onEditInstallment,
    td,
    tl,
  ]);

  if (rows.length === 0) {
    return (
      <p className="px-1 text-sm text-on-surface-variant">
        {td('scheduleEmpty')}
      </p>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.key}
      // Opens where the next payment is.
      initialRowIndex={Math.max(
        0,
        rows.findIndex(
          (row) => row.status === 'upcoming' || row.status === 'overdue',
        ),
      )}
      labels={labels}
      className="rounded-card border border-outline bg-surface"
    />
  );
}
