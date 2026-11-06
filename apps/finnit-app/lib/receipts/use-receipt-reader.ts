import * as React from 'react';

import { RECEIPT_IMPORT_QUERY, RECEIPT_STATUS_QUERY, type ReceiptImport, type ReceiptStatus } from '@finnit/core/receipts/graphql';

import { useGql } from '@/lib/graphql/runner';
import { UploadError, uploadFile, type LocalFile } from '@/lib/files/upload';

const POLL_MS = 1_500;
const MAX_MS = 60_000;

/** Why there's nothing to review; keys under `receipts.errors` / `receipts.failed`. */
export type ReceiptFailure = 'uploadNetwork' | 'uploadTooLarge' | 'uploadInvalid' | 'uploadFailed' | 'readFailed' | 'timeout' | 'discarded' | 'alreadyConfirmed';

export type ReceiptReaderState =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'reading' }
  | { phase: 'ready'; receipt: ReceiptImport }
  | { phase: 'failed'; reason: ReceiptFailure };

function uploadFailure(error: unknown): ReceiptFailure {
  const status = error instanceof UploadError ? error.status : 0;
  if (status === 0) return 'uploadNetwork';
  if (status === 413) return 'uploadTooLarge';
  if (status === 400 || status === 415 || status === 422) return 'uploadInvalid';
  return 'uploadFailed';
}

const reading = (status: ReceiptStatus) => status === 'uploaded' || status === 'processing';

/**
 * Reading a receipt photo (the web's useReceiptReader): upload it, then ask
 * for the import every 1.5 s while the server reads it, for up to a minute.
 */
export function useReceiptReader() {
  const gql = useGql();
  const [state, setState] = React.useState<ReceiptReaderState>({ phase: 'idle' });
  const cancelled = React.useRef(false);
  React.useEffect(() => () => void (cancelled.current = true), []);

  const read = React.useCallback(
    async (file: LocalFile) => {
      cancelled.current = false;
      setState({ phase: 'uploading' });
      let uploaded: { id: string; status: ReceiptStatus };
      try {
        uploaded = await uploadFile('/receipts', file);
      } catch (e) {
        setState({ phase: 'failed', reason: uploadFailure(e) });
        return;
      }
      setState({ phase: 'reading' });
      const started = Date.now();
      let status = uploaded.status;
      while (reading(status)) {
        if (cancelled.current) return;
        if (Date.now() - started > MAX_MS) {
          setState({ phase: 'failed', reason: 'timeout' });
          return;
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
        try {
          status = (await gql<{ receiptImport: { status: ReceiptStatus } }>(RECEIPT_STATUS_QUERY, { id: uploaded.id })).receiptImport.status;
        } catch {
          // A failed poll: try again next time.
        }
      }
      if (status === 'confirmed') return setState({ phase: 'failed', reason: 'alreadyConfirmed' });
      if (status === 'discarded') return setState({ phase: 'failed', reason: 'discarded' });
      if (status !== 'needs_review') return setState({ phase: 'failed', reason: 'readFailed' });
      try {
        const { receiptImport } = await gql<{ receiptImport: ReceiptImport }>(RECEIPT_IMPORT_QUERY, { id: uploaded.id });
        if (!cancelled.current) setState({ phase: 'ready', receipt: receiptImport });
      } catch {
        setState({ phase: 'failed', reason: 'readFailed' });
      }
    },
    [gql],
  );

  const reset = React.useCallback(() => {
    cancelled.current = true;
    setState({ phase: 'idle' });
  }, []);

  return { state, read, reset };
}
