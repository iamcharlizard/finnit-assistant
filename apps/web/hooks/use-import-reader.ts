'use client';

import * as React from 'react';

import {
  RECEIPT_POLL_INTERVAL_MS,
  readerReducer,
  type ReadableImport,
  type ReaderEvent,
  type ReaderState,
} from '@/lib/receipts/reader';
import {
  ReceiptUploadError,
  type UploadedReceipt,
} from '@/lib/receipts/upload';

const IDLE = { phase: 'idle' } as const;

/**
 * Uploads an image and follows its import until it's read (see
 * lib/receipts/reader.ts): receipts and screenshots alike. Polling stops on
 * a final status, after a minute, or when the component unmounts. `onReady`
 * gets the import once it's read and waiting for review.
 */
export function useImportReader<T extends ReadableImport>({
  upload,
  fetchImport,
  onReady,
}: {
  upload: (
    file: File,
    onProgress: (percent: number) => void,
  ) => Promise<UploadedReceipt>;
  fetchImport: (id: string) => Promise<T>;
  onReady: (read: T) => void;
}) {
  const [state, dispatch] = React.useReducer<ReaderState<T>, [ReaderEvent<T>]>(
    readerReducer,
    IDLE,
  );
  const latest = React.useRef({ upload, fetchImport, onReady });
  React.useEffect(() => {
    latest.current = { upload, fetchImport, onReady };
  });

  const read = React.useCallback(async (file: File) => {
    dispatch({ type: 'start' });
    try {
      const uploaded = await latest.current.upload(file, (percent) =>
        dispatch({ type: 'progress', percent }),
      );
      dispatch({ type: 'uploaded', receipt: uploaded, now: Date.now() });
    } catch (error) {
      dispatch({
        type: 'uploadFailed',
        status: error instanceof ReceiptUploadError ? error.status : 0,
      });
    }
  }, []);

  const importId = state.phase === 'reading' ? state.receiptId : null;
  const startedAt = state.phase === 'reading' ? state.startedAt : 0;
  const immediate = state.phase === 'reading' && state.immediate;

  React.useEffect(() => {
    if (!importId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const read = await latest.current.fetchImport(importId);
        if (stopped) return;
        dispatch({ type: 'polled', receipt: read, now: Date.now() });
        if (read.status === 'needs_review') {
          latest.current.onReady(read);
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
  }, [importId, startedAt]);

  const keepWaiting = React.useCallback(
    () => dispatch({ type: 'keepWaiting', now: Date.now() }),
    [],
  );
  const reset = React.useCallback(() => dispatch({ type: 'reset' }), []);

  return { state, read, keepWaiting, reset };
}
