'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { DataTable, type ColumnDef } from '@finnit/ui/components/ui/data-table';

import { useTableLabels } from '@/components/use-table-labels';
import type { LentRow } from '@/lib/debts/detail-view';

/**
 * Every amount of the loan: the first one and each added later (another
 * loan from the same person, a purchase with their card…), with when, how
 * it was lent and what for. Newest first; amounts without a date go last.
 */
export function LoanLentTable({
  rows,
  busy,
  onDelete,
}: {
  rows: LentRow[];
  busy: string | null;
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
            {row.original.total ? (
              <span className="text-xs text-on-surface-variant">
                {td('lent.toRepay', { amount: row.original.total })}
              </span>
            ) : null}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{td('columns.actions')}</span>,
        cell: ({ row }) =>
          row.original.chargeId ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 min-h-8"
              disabled={busy === row.original.chargeId}
              aria-label={td('deleteCharge')}
              onClick={() => onDelete(row.original.chargeId!)}
            >
              <Trash2 aria-hidden />
            </Button>
          ) : null,
        meta: { align: 'right', headerClassName: 'w-12' },
      },
    ],
    [busy, onDelete, td],
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
