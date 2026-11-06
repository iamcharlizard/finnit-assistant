'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeftRight, Eye, MoreVertical, PencilLine } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@finnit/ui/components/ui/dropdown-menu';

import { TransactionStatusRow } from '@/components/finance/transaction-status-row';
import type { HistoryRow as Row } from '@/lib/history/view';

/** A history movement with its "⋮" menu: detail, description, transfer. */
export function HistoryRow({
  row,
  onRename,
  onConvert,
}: {
  row: Row;
  onRename: () => void;
  onConvert: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-1">
      <div className="min-w-0 flex-1">
        <TransactionStatusRow row={row} />
      </div>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('history.rowMenu', { name: row.title })}
            className="shrink-0 text-on-surface-variant"
          >
            <MoreVertical aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/transactions/${row.id}`}>
              <Eye /> {t('transaction.viewDetail')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onRename}>
            <PencilLine /> {t('categorize.rename')}
          </DropdownMenuItem>
          {row.convert ? (
            <DropdownMenuItem onSelect={onConvert}>
              <ArrowLeftRight /> {t('transfers.convert.action')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
