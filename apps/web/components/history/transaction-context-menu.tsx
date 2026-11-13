'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowLeftRight,
  Ban,
  CreditCard,
  Eye,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@finnit/ui/components/ui/context-menu';
import { toast } from '@finnit/ui/components/ui/toaster';

import { useTransactionDrawer } from '@/components/transaction-detail/transaction-drawer';
import { useMovementActions } from '@/components/transaction-detail/use-movement-actions';
import { ConvertTransferDialog } from '@/components/transfers/convert-transfer-dialog';
import type { HistoryRow } from '@finnit/core/history/view';
import {
  canRecordCardPayment,
  type ConvertMode,
} from '@finnit/core/transfers/convert';

/**
 * Right-click (long press on touch) actions of a history movement: view its
 * detail, rename it, turn it into a transfer or a card payment, mark it
 * cancelled (or reactivate it) and delete it. The same rules as the
 * detail's "⋯" menu; dialogs open from here. Wraps the movement's card.
 */
export function TransactionContextMenu({
  row,
  creditCardIds,
  onChanged,
  onRename,
  children,
}: {
  row: HistoryRow;
  /** The user's open credit cards ("Registrar como pago a tarjeta"). */
  creditCardIds: ReadonlyArray<string>;
  /** Something changed: the list reloads. */
  onChanged: () => void;
  /** Opens the card's name field ("Renombrar"); absent: no rename. */
  onRename?: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const drawer = useTransactionDrawer();
  const [convert, setConvert] = React.useState<ConvertMode | null>(null);
  const movement = useMovementActions({
    onDeleted: onChanged,
    onChanged,
  });
  const cardPayment =
    row.convert !== null &&
    canRecordCardPayment(row.convert, row.accountType, creditCardIds);
  const cancelled = row.status === 'cancelled';

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div data-slot="transaction-context-trigger">{children}</div>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-56">
          <ContextMenuItem
            onSelect={() => drawer.open(row.id, { onChange: onChanged })}
          >
            <Eye aria-hidden /> {t('history.rowMenu.open')}
          </ContextMenuItem>
          {onRename ? (
            <ContextMenuItem onSelect={onRename}>
              <Pencil aria-hidden /> {t('history.rowMenu.rename')}
            </ContextMenuItem>
          ) : null}
          {row.convert ? (
            <ContextMenuItem onSelect={() => setConvert('transfer')}>
              <ArrowLeftRight aria-hidden /> {t('transfers.convert.action')}
            </ContextMenuItem>
          ) : null}
          {cardPayment ? (
            <ContextMenuItem onSelect={() => setConvert('cardPayment')}>
              <CreditCard aria-hidden /> {t('transfers.cardPayment.action')}
            </ContextMenuItem>
          ) : null}
          {row.canCancel ? (
            <ContextMenuItem
              disabled={movement.busy}
              onSelect={() => void movement.askCancel({ id: row.id })}
            >
              <Ban aria-hidden /> {t('transaction.cancel.action')}
            </ContextMenuItem>
          ) : null}
          {cancelled ? (
            <ContextMenuItem
              disabled={movement.busy}
              onSelect={() => movement.restore(row.id)}
            >
              <RotateCcw aria-hidden /> {t('transaction.cancel.restore')}
            </ContextMenuItem>
          ) : null}
          {row.deletable ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                disabled={movement.busy}
                onSelect={() =>
                  void movement.askDelete({
                    id: row.id,
                    accountLabel: row.accountLabel,
                    canCancel: row.canCancel,
                  })
                }
              >
                <Trash2 aria-hidden /> {t('transaction.delete')}
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>

      {convert && row.convert ? (
        <ConvertTransferDialog
          source={row.convert}
          mode={convert}
          onClose={() => setConvert(null)}
          onConverted={() => {
            const mode = convert;
            setConvert(null);
            toast.success(
              t(
                mode === 'cardPayment'
                  ? 'transfers.cardPayment.done'
                  : 'transfers.convert.done',
              ),
            );
            onChanged();
          }}
        />
      ) : null}
      {movement.dialog}
    </>
  );
}
