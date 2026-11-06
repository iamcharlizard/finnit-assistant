'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { DataTable, type ColumnDef } from '@finnit/ui/components/ui/data-table';

import { useTableLabels } from '@/components/use-table-labels';
import type { WaitlistRow } from '@/lib/admin/waitlist';

/** Who joined the landing page's waitlist, newest first. */
export function WaitlistTable({ rows }: { rows: WaitlistRow[] }) {
  const t = useTranslations('admin.waitlist');
  const labels = useTableLabels();
  const columns = React.useMemo<ColumnDef<WaitlistRow>[]>(
    () => [
      { accessorKey: 'email', header: t('columns.email'), enableSorting: true },
      {
        accessorKey: 'source',
        header: t('columns.source'),
        enableSorting: true,
      },
      { accessorKey: 'locale', header: t('columns.locale') },
      {
        accessorKey: 'joinedAt',
        header: t('columns.joinedAt'),
        enableSorting: true,
        sortingFn: 'text',
        meta: {
          align: 'right',
          cellClassName: 'whitespace-nowrap tabular-nums',
        },
      },
    ],
    [t],
  );

  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-outline bg-surface p-6 text-sm text-on-surface-variant">
        {t('empty')}
      </p>
    );
  }
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      labels={labels}
      className="rounded-card border border-outline bg-surface"
    />
  );
}
