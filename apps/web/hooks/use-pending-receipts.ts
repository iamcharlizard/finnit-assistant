'use client';

import * as React from 'react';

import { gql } from '@/lib/graphql/client';
import {
  RECEIPT_IMPORTS_QUERY,
  type ReceiptImport,
  type ReceiptImportsData,
} from '@/lib/receipts/graphql';
import { pendingReceipts } from '@/lib/receipts/prefill';

/**
 * Receipts read and waiting for review ("Tickets pendientes"), fetched while
 * `active`. A failed request just shows nothing: the list is a shortcut.
 */
export function usePendingReceipts(active: boolean): ReceiptImport[] {
  const [receipts, setReceipts] = React.useState<ReceiptImport[]>([]);

  React.useEffect(() => {
    if (!active) return;
    let cancelled = false;
    gql<ReceiptImportsData>(RECEIPT_IMPORTS_QUERY, { first: 5 })
      .then((data) => {
        if (!cancelled) {
          setReceipts(
            pendingReceipts(data.receiptImports.edges.map((e) => e.node)),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setReceipts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return receipts;
}
