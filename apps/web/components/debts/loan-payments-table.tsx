'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import { DataTable, type ColumnDef } from '@finnit/ui/components/ui/data-table';

import { useTableLabels } from '@/components/use-table-labels';
import type { PaymentRow } from '@/lib/debts/detail-view';

/**
 * Payments made on the loan, newest first: those made before registering it
 * (outside the totals, removable here) and those that count as expenses.
 * Sortable by date and amount.
 */
export function LoanPaymentsTable({
  rows,
  busy,
  onDelete,
}: {
  rows: PaymentRow[];
  busy: string | null;
  onDelete: (id: string) => void;
}) {
  const td = useTranslations('debts.detail');
  const labels = useTableLabels();

  const columns = React.useMemo<ColumnDef<PaymentRow>[]>(
    () => [
      {
        accessorKey: 'date',
        header: td('columns.date'),
        enableSorting: true,
        sortingFn: 'text',
        cell: ({ row }) => row.original.dateLabel,
        meta: { cellClassName: 'whitespace-nowrap' },
      },
      {
        id: 'kind',
        header: td('columns.kind'),
        cell: ({ row }) =>
          row.original.isHistorical ? (
            <Badge variant="muted">{td('historical')}</Badge>
          ) : (
            <Badge variant="income">{td('counted')}</Badge>
          ),
      },
      {
        accessorKey: 'value',
        header: td('columns.amount'),
        enableSorting: true,
        cell: ({ row }) => row.original.amount,
        meta: { align: 'right', cellClassName: 'font-medium' },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{td('columns.actions')}</span>,
        cell: ({ row }) =>
          row.original.isHistorical ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={busy === row.original.id}
              aria-label={td('deletePayment')}
              onClick={() => onDelete(row.original.id)}
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
      getRowId={(row) => row.id}
      initialSorting={[{ id: 'date', desc: true }]}
      labels={labels}
      className="rounded-card border border-outline bg-surface"
    />
  );
}
