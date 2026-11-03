'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Trash2 } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { DataTable, type ColumnDef } from '@finnit/ui/components/ui/data-table';

import { useTableLabels } from '@/components/use-table-labels';
import type { LentRow } from '@/lib/debts/detail-view';

/**
 * Every amount of the loan: the first one and each added later (another
 * loan from the same person, a purchase with their card…), with when, how
 * it was lent and what for. Newest first; amounts without a date go last.
 * Amounts added later can be edited or removed.
 */
export function LoanLentTable({
  rows,
  busy,
  onEdit,
  onDelete,
}: {
  rows: LentRow[];
  busy: string | null;
  onEdit: (chargeId: string) => void;
  onDelete: (chargeId: string) => void;
}) {
  const td = useTranslations('debts.detail');
  const labels = useTableLabels();

  const columns = React.useMemo<ColumnDef<LentRow>[]>(
    () => [
      {
        id: 'date',
        // Unknown dates stay at the end in both directions.
        accessorFn: (row) => row.date || undefined,
        sortUndefined: 'last',
        sortingFn: 'text',
        header: td('columns.date'),
        enableSorting: true,
        cell: ({ row }) => row.original.dateLabel,
        meta: { cellClassName: 'whitespace-nowrap' },
      },
      {
        id: 'description',
        header: td('columns.description'),
        cell: ({ row }) => (
          <span className="block max-w-56 truncate">
            {row.original.description}
          </span>
        ),
      },
      {
        id: 'method',
        header: td('columns.method'),
        cell: ({ row }) => row.original.method ?? '—',
        meta: { cellClassName: 'whitespace-nowrap' },
      },
      {
        id: 'purpose',
        header: td('columns.purpose'),
        cell: ({ row }) => row.original.purpose ?? '—',
        meta: { cellClassName: 'text-on-surface-variant' },
      },
      {
        accessorKey: 'value',
        header: td('columns.amount'),
        enableSorting: true,
        cell: ({ row }) => (
          <span className="flex flex-col items-end leading-tight">
            <span className="font-medium">{row.original.amount}</span>
            {row.original.total || row.original.installments ? (
              <span className="text-xs text-on-surface-variant">
                {[
                  row.original.total
                    ? td('lent.toRepay', { amount: row.original.total })
                    : null,
                  row.original.installments
                    ? td('lent.installments', {
                        count: row.original.installments,
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(' ')}
              </span>
            ) : null}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{td('columns.actions')}</span>,
        cell: ({ row }) => {
          const id = row.original.chargeId;
          if (!id) return null;
          return (
            <span className="flex justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 min-h-8"
                disabled={busy === id}
                aria-label={td('editCharge')}
                onClick={() => onEdit(id)}
              >
                <Pencil aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 min-h-8"
                disabled={busy === id}
                aria-label={td('deleteCharge')}
                onClick={() => onDelete(id)}
              >
                <Trash2 aria-hidden />
              </Button>
            </span>
          );
        },
        meta: { align: 'right', headerClassName: 'w-20' },
      },
    ],
    [busy, onDelete, onEdit, td],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.key}
      initialSorting={[{ id: 'date', desc: true }]}
      labels={labels}
      className="rounded-card border border-outline bg-surface"
    />
  );
}
