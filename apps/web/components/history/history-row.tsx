'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { toast } from '@finnit/ui/components/ui/toaster';

import { SuggestionChip } from '@/components/categorize/suggestion-chip';
import { TransactionListCard } from '@/components/finance/transaction-card';
import { TransactionContextMenu } from './transaction-context-menu';
import {
  categorizeErrorMessage,
  reviewSuggestions,
} from '@finnit/core/categorize/api';
import type { HistoryRow as Row } from '@finnit/core/history/view';
import { gql } from '@/lib/graphql/client';

/**
 * A history movement: the card opens its detail (drawer or modal), where
 * its name rules, transfer conversion and the rest live; the pencil by the
 * name renames just this one. A pending AI category suggestion shows inside
 * it, to accept or reject right there. Right-click opens its actions
 * (TransactionContextMenu).
 */
export function HistoryRow({
  row,
  creditCardIds,
  onChanged,
}: {
  row: Row;
  /** The user's open credit cards (the right-click menu's card payment). */
  creditCardIds: ReadonlyArray<string>;
  /** Renamed or categorized: the page reloads its data. */
  onChanged: () => void;
}) {
  const t = useTranslations();
  const [busy, setBusy] = React.useState(false);
  // "Renombrar" from the right-click menu opens the card's name field.
  const [renameRequest, setRenameRequest] = React.useState(0);

  const review = async (action: 'accept' | 'reject') => {
    if (busy) return;
    setBusy(true);
    try {
      const count = await reviewSuggestions(action, [row.id], gql);
      toast.success(
        t(
          action === 'accept'
            ? 'categorize.toasts.accepted'
            : 'categorize.toasts.rejected',
          { count },
        ),
      );
      onChanged();
    } catch (e) {
      toast.error(categorizeErrorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <TransactionContextMenu
      row={row}
      creditCardIds={creditCardIds}
      onChanged={onChanged}
      onRename={() => setRenameRequest((n) => n + 1)}
    >
      <TransactionListCard
        row={row}
        showStatus
        renameRequest={renameRequest}
        onRenamed={onChanged}
        footer={
          row.suggestion ? (
            <SuggestionChip
              label={row.suggestion.label}
              busy={busy}
              onAccept={() => void review('accept')}
              onReject={() => void review('reject')}
            />
          ) : null
        }
      />
    </TransactionContextMenu>
  );
}
