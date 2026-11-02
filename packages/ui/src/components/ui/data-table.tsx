'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from '@tanstack/react-table';
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from 'lucide-react';

import { cn } from '../../lib/utils';
import { Button } from './button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Right-aligns header and cells (amounts). */
    align?: 'right';
    /** Extra classes for this column's header. */
    headerClassName?: string;
    /** Extra classes for this column's cells. */
    cellClassName?: string;
  }
}

interface DataTableLabels {
  rowsPerPage: string;
  /** "Page 2 of 5". */
  page: (page: number, pageCount: number) => string;
  firstPage: string;
  previousPage: string;
  nextPage: string;
  lastPage: string;
  /** Accessible name of a sortable header's button. */
  sortBy: (column: string) => string;
  empty: string;
}

const defaultLabels: DataTableLabels = {
  rowsPerPage: 'Rows per page',
  page: (page, pageCount) => `Page ${page} of ${pageCount}`,
  firstPage: 'First page',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  lastPage: 'Last page',
  sortBy: (column) => `Sort by ${column}`,
  empty: 'No results.',
};

interface DataTableProps<TData> {
  // Each column has its own value type; TanStack's own docs type them so.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[];
  data: TData[];
  getRowId?: (row: TData, index: number) => string;
  /** Rows per page at first; the reader can change it. */
  pageSize?: number;
  pageSizes?: number[];
  /** false shows every row (no pager). */
  paginate?: boolean;
  initialSorting?: SortingState;
  /** Opens on the page that has this row (index in `data`). */
  initialRowIndex?: number;
  labels?: Partial<DataTableLabels>;
  className?: string;
  rowClassName?: (row: TData) => string | undefined;
}

/**
 * A table on TanStack Table: columns sort only when they say so
 * (`enableSorting`, default off here), rows come in pages with a rows-per-page
 * selector beside the pager. Column `meta` aligns amounts to the right.
 */
function DataTable<TData>({
  columns,
  data,
  getRowId,
  pageSize = 5,
  pageSizes = [5, 10, 25, 50],
  paginate = true,
  initialSorting = [],
  initialRowIndex = 0,
  labels: labelsProp,
  className,
  rowClassName,
}: DataTableProps<TData>) {
  const labels = { ...defaultLabels, ...labelsProp };
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [pagination, setPagination] = React.useState({
    pageIndex: paginate
      ? Math.floor(Math.max(0, initialRowIndex) / pageSize)
      : 0,
    pageSize,
  });

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    defaultColumn: { enableSorting: false },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(paginate && { getPaginationRowModel: getPaginationRowModel() }),
    autoResetPageIndex: false,
  });

  const pageCount = Math.max(1, table.getPageCount());
  const page = Math.min(pagination.pageIndex + 1, pageCount);
  const showPager = paginate && data.length > Math.min(...pageSizes);
  const align = (meta?: { align?: 'right' }) =>
    meta?.align === 'right' ? 'text-right' : undefined;

  return (
    <div data-slot="data-table" className={cn('flex flex-col', className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const meta = header.column.columnDef.meta;
                const sorted = header.column.getIsSorted();
                const content = header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    );
                const SortIcon =
                  sorted === 'asc'
                    ? ArrowUpIcon
                    : sorted === 'desc'
                      ? ArrowDownIcon
                      : ArrowUpDownIcon;
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      sorted === 'asc'
                        ? 'ascending'
                        : sorted === 'desc'
                          ? 'descending'
                          : undefined
                    }
                    className={cn(align(meta), meta?.headerClassName)}
                  >
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        aria-label={labels.sortBy(
                          typeof header.column.columnDef.header === 'string'
                            ? header.column.columnDef.header
                            : header.column.id,
                        )}
                        className={cn(
                          '-mx-1 inline-flex items-center gap-1 rounded-sm px-1 uppercase outline-none hover:text-on-background focus-visible:ring-[3px] focus-visible:ring-ring/50',
                          sorted && 'text-on-background',
                        )}
                      >
                        {content}
                        <SortIcon
                          aria-hidden
                          className={cn('size-3.5', !sorted && 'opacity-50')}
                        />
                      </button>
                    ) : (
                      content
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="py-8 text-center text-on-surface-variant"
              >
                {labels.empty}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              // Every row is 56px, with or without a button: buttons in rows must be
              // at most 40px (Button has min-h-11, so override it with min-h-8).
              <TableRow
                key={row.id}
                className={cn('h-14', rowClassName?.(row.original))}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'py-2',
                        align(meta),
                        meta?.align === 'right' &&
                          'whitespace-nowrap tabular-nums',
                        meta?.cellClassName,
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {showPager ? (
        <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 border-t border-outline px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <span aria-hidden>{labels.rowsPerPage}</span>
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(value) =>
                setPagination({ pageIndex: 0, pageSize: Number(value) })
              }
            >
              <SelectTrigger
                aria-label={labels.rowsPerPage}
                className="min-h-9 w-20 px-3"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizes.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <span
              aria-live="polite"
              className="mr-2 text-sm whitespace-nowrap text-on-surface-variant tabular-nums"
            >
              {labels.page(page, pageCount)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={labels.firstPage}
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.setPageIndex(0)}
            >
              <ChevronsLeftIcon aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={labels.previousPage}
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={labels.nextPage}
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRightIcon aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={labels.lastPage}
              disabled={!table.getCanNextPage()}
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            >
              <ChevronsRightIcon aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export {
  DataTable,
  type DataTableProps,
  type DataTableLabels,
  type ColumnDef,
  type SortingState,
};
