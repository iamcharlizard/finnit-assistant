'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { toast } from '@finnit/ui/components/ui/toaster';

import {
  ConfirmDialog,
  type ConfirmRequest,
} from '@/components/admin/confirm-dialog';
import {
  deleteTransaction,
  transactionErrorMessage,
} from '@finnit/core/transaction-detail/api';
import {
  cancelTransaction,
  cancellationNote,
  loadCancellationCheck,
  restoreTransaction,
} from '@finnit/core/transaction-detail/cancellation';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

/** What deleting or cancelling a movement needs to know about it. */
export interface MovementForActions {
  id: string;
  /** "BBVA Débito": where its balance changes. */
  accountLabel: string;
  /** What else deleting does (the detail's deleteNotes). */
  deleteNotes?: ReadonlyArray<string>;
  /** "Marcar como cancelado" applies (an expense or income on a card). */
  canCancel: boolean;
}

/**
 * Deleting, cancelling ("Marcar como cancelado") and reactivating a
 * movement, with their confirmations: shared by the detail and the
 * history's context menu. On a card, deleting also offers cancelling, and
 * both say what the movement's statement shows. Render `dialog`.
 */
export function useMovementActions({
  onDeleted,
  onChanged,
}: {
  onDeleted: () => void;
  /** Cancelled or reactivated. */
  onChanged: () => void;
}) {
  const l = useLocalizer();
  const tt = useTranslations('transaction');
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = React.useState(false);

  const run = React.useCallback(
    async (action: () => Promise<void>, done: string, after: () => void) => {
      setConfirm(null);
      setBusy(true);
      try {
        await action();
        toast.success(done);
        after();
      } catch (error) {
        toast.error(transactionErrorMessage(error, l.t));
      } finally {
        setBusy(false);
      }
    },
    [l],
  );

  const cancel = (id: string) =>
    void run(() => cancelTransaction(id, gql), tt('cancel.done'), onChanged);

  /** The statement's word on it (or the reminder to check it). */
  async function statementNote(id: string): Promise<string> {
    setBusy(true);
    const check = await loadCancellationCheck(id, gql);
    setBusy(false);
    return cancellationNote(check, l);
  }

  async function askDelete(movement: MovementForActions) {
    const note = movement.canCancel ? await statementNote(movement.id) : null;
    setConfirm({
      title: tt('deleteTitle'),
      description: [
        tt('deleteDescription', { account: movement.accountLabel }),
        ...(movement.deleteNotes ?? []),
        ...(note ? [tt('cancel.deleteSuggestion'), note] : []),
      ].join(' '),
      confirmLabel: tt('delete'),
      destructive: true,
      onConfirm: () =>
        void run(
          () => deleteTransaction(movement.id, gql),
          tt('toasts.deleted'),
          onDeleted,
        ),
      ...(movement.canCancel && {
        secondary: {
          label: tt('cancel.action'),
          onConfirm: () => cancel(movement.id),
        },
      }),
    });
  }

  async function askCancel(movement: Pick<MovementForActions, 'id'>) {
    const note = await statementNote(movement.id);
    setConfirm({
      title: tt('cancel.title'),
      description: [tt('cancel.description'), note].join(' '),
      confirmLabel: tt('cancel.confirm'),
      onConfirm: () => cancel(movement.id),
    });
  }

  function restore(id: string) {
    void run(
      () => restoreTransaction(id, gql),
      tt('cancel.restored'),
      onChanged,
    );
  }

  return {
    askDelete,
    askCancel,
    restore,
    busy,
    dialog: (
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    ),
  };
}
