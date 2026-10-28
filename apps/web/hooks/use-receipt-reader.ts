'use client';

import * as React from 'react';

import { gql } from '@/lib/graphql/client';
import {
  RECEIPT_IMPORT_QUERY,
  type ReceiptImport,
} from '@/lib/receipts/graphql';
import {
  READER_IDLE,
  RECEIPT_POLL_INTERVAL_MS,
  readerReducer,
} from '@/lib/receipts/reader';
import { ReceiptUploadError, uploadReceipt } from '@/lib/receipts/upload';

/**
 * Uploads a receipt photo and follows the import until it's read (see
 * lib/receipts/reader.ts). Polling stops on a final status, after a minute,
 * or when the component unmounts. `onReady` gets the import once it's read
 * and waiting for review.
 */
export function useReceiptReader(onReady: (receipt: ReceiptImport) => void) {
  const [state, dispatch] = React.useReducer(readerReducer, READER_IDLE);
  const ready = React.useRef(onReady);
  React.useEffect(() => {
    ready.current = onReady;
  });

  const read = React.useCallback(async (file: File) => {
    dispatch({ type: 'start' });
    try {
      const receipt = await uploadReceipt(file, (percent) =>
        dispatch({ type: 'progress', percent }),
      );
      dispatch({ type: 'uploaded', receipt, now: Date.now() });
    } catch (error) {
      dispatch({
        type: 'uploadFailed',
        status: error instanceof ReceiptUploadError ? error.status : 0,
      });
    }
  }, []);

  const receiptId = state.phase === 'reading' ? state.receiptId : null;
  const startedAt = state.phase === 'reading' ? state.startedAt : 0;
  const immediate = state.phase === 'reading' && state.immediate;

  React.useEffect(() => {
    if (!receiptId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const { receiptImport } = await gql<{ receiptImport: ReceiptImport }>(
          RECEIPT_IMPORT_QUERY,
          { id: receiptId },
        );
        if (stopped) return;
        dispatch({ type: 'polled', receipt: receiptImport, now: Date.now() });
        if (receiptImport.status === 'needs_review') {
          ready.current(receiptImport);
          return;
        }
      } catch {
        if (stopped) return;
        dispatch({ type: 'pollFailed', now: Date.now() });
      }
      // Ask again; the reducer decides when it's over, and the change of
      // phase runs this effect's cleanup, which cancels the timer.
      timer = setTimeout(() => void tick(), RECEIPT_POLL_INTERVAL_MS);
    };
    timer = setTimeout(
      () => void tick(),
      immediate ? 0 : RECEIPT_POLL_INTERVAL_MS,
    );
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
    // `immediate` only matters for the first request of a round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptId, startedAt]);

  const keepWaiting = React.useCallback(
    () => dispatch({ type: 'keepWaiting', now: Date.now() }),
    [],
  );
  const reset = React.useCallback(() => dispatch({ type: 'reset' }), []);

  return { state, read, keepWaiting, reset };
}
