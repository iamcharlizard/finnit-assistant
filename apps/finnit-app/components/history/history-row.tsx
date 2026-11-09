import * as React from 'react';
import { useTranslations } from 'use-intl';

import {
  categorizeErrorMessage,
  reviewSuggestions,
} from '@finnit/core/categorize/api';
import type { HistoryRow as Row } from '@finnit/core/history/view';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { SuggestionPill } from '@/components/categorize/suggestion-pill';
import { TransactionListCard } from '@/components/finance/transaction-card';
import { useGql } from '@/lib/graphql/runner';
import { emitTransactionsChanged } from '@/lib/transactions/events';

/** A history movement; a pending AI category suggestion shows inside it to accept or reject. */
export function HistoryRow({ row }: { row: Row }) {
  const t = useTranslations();
  const gql = useGql();
  const [busy, setBusy] = React.useState(false);

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
      emitTransactionsChanged(row.id);
    } catch (e) {
      toast.error(categorizeErrorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <TransactionListCard
      row={row}
      showStatus
      footer={
        row.suggestion ? (
          <SuggestionPill
            label={row.suggestion.label}
            busy={busy}
            onAccept={() => void review('accept')}
            onReject={() => void review('reject')}
          />
        ) : undefined
      }
    />
  );
}
