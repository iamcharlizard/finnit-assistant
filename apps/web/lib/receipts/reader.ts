import type { ReceiptImport, ReceiptStatus } from './graphql';

/** What the reader follows: a receipt, or any import read the same way. */
export interface ReadableImport {
  id: string;
  status: ReceiptStatus;
}
import {
  receiptUploadErrorKey,
  type ReceiptUploadErrorKey,
  type UploadedReceipt,
} from './upload';

/**
 * Reading a receipt as a state machine: upload the photo, then ask for the
 * import every 1.5 s while the server reads it (uploaded/processing), for up
 * to a minute. Pure, so the hook (hooks/use-receipt-reader.ts) only wires
 * timers and requests to it.
 */
export const RECEIPT_POLL_INTERVAL_MS = 1_500;
export const RECEIPT_POLL_MAX_MS = 60_000;

/** Why there is nothing to review. Keys under `receipts.failed`/`receipts.errors`. */
export type ReaderFailure =
  | ReceiptUploadErrorKey
  /** The server couldn't read it (e.g. the OCR service is down). */
  | 'readFailed'
  /** Still reading after a minute. */
  | 'timeout'
  /** The same photo was uploaded and discarded before. */
  | 'discarded'
  /** The same photo was already registered. */
  | 'alreadyConfirmed';

export type ReaderState<T extends ReadableImport = ReceiptImport> =
  | { phase: 'idle' }
  | { phase: 'uploading'; progress: number }
  | {
      phase: 'reading';
      receiptId: string;
      startedAt: number;
      /** Ask right away (the upload already answered with a final status). */
      immediate: boolean;
    }
  | { phase: 'ready'; receipt: T }
  | { phase: 'failed'; reason: ReaderFailure; receiptId: string | null };

export type ReaderEvent<T extends ReadableImport = ReceiptImport> =
  | { type: 'start' }
  | { type: 'progress'; percent: number }
  | { type: 'uploaded'; receipt: UploadedReceipt; now: number }
  | { type: 'uploadFailed'; status: number }
  | { type: 'polled'; receipt: T; now: number }
  | { type: 'pollFailed'; now: number }
  /** After a timeout: keep asking for another minute. */
  | { type: 'keepWaiting'; now: number }
  | { type: 'reset' };

export const READER_IDLE: ReaderState = { phase: 'idle' };

export function isReading(status: ReceiptStatus): boolean {
  return status === 'uploaded' || status === 'processing';
}

/** Where a status leaves the reader (null: still reading). */
export function outcomeOf<T extends ReadableImport>(
  receipt: T,
): ReaderState<T> | null {
  switch (receipt.status) {
    case 'uploaded':
    case 'processing':
      return null;
    case 'needs_review':
      return { phase: 'ready', receipt };
    case 'confirmed':
      return {
        phase: 'failed',
        reason: 'alreadyConfirmed',
        receiptId: receipt.id,
      };
    case 'discarded':
      return { phase: 'failed', reason: 'discarded', receiptId: receipt.id };
    case 'failed':
    default:
      return { phase: 'failed', reason: 'readFailed', receiptId: receipt.id };
  }
}

export function readerReducer<T extends ReadableImport = ReceiptImport>(
  state: ReaderState<T>,
  event: ReaderEvent<NoInfer<T>>,
): ReaderState<T> {
  switch (event.type) {
    case 'start':
      return { phase: 'uploading', progress: 0 };
    case 'progress':
      return state.phase === 'uploading'
        ? { phase: 'uploading', progress: event.percent }
        : state;
    case 'uploaded':
      if (state.phase !== 'uploading') return state;
      return {
        phase: 'reading',
        receiptId: event.receipt.id,
        startedAt: event.now,
        immediate: !isReading(event.receipt.status),
      };
    case 'uploadFailed':
      if (state.phase !== 'uploading') return state;
      return {
        phase: 'failed',
        reason: receiptUploadErrorKey(event.status),
        receiptId: null,
      };
    case 'polled': {
      if (state.phase !== 'reading' || event.receipt.id !== state.receiptId) {
        return state;
      }
      const outcome = outcomeOf(event.receipt);
      if (outcome) return outcome;
      return timedOut(state, event.now);
    }
    case 'pollFailed':
      return state.phase === 'reading' ? timedOut(state, event.now) : state;
    case 'keepWaiting':
      if (
        state.phase !== 'failed' ||
        state.reason !== 'timeout' ||
        !state.receiptId
      ) {
        return state;
      }
      return {
        phase: 'reading',
        receiptId: state.receiptId,
        startedAt: event.now,
        immediate: true,
      };
    case 'reset':
      return READER_IDLE as ReaderState<never>;
  }
}

function timedOut<T extends ReadableImport>(
  state: Extract<ReaderState<T>, { phase: 'reading' }>,
  now: number,
): ReaderState<T> {
  if (now - state.startedAt < RECEIPT_POLL_MAX_MS) {
    return state.immediate ? { ...state, immediate: false } : state;
  }
  return { phase: 'failed', reason: 'timeout', receiptId: state.receiptId };
}

/** The import a failure leaves behind, which "Capturar a mano" discards. */
export function leftoverReceiptId<T extends ReadableImport>(
  state: ReaderState<T>,
): string | null {
  if (state.phase === 'failed') {
    // Already confirmed or discarded imports are kept as they are.
    return state.reason === 'readFailed' || state.reason === 'timeout'
      ? state.receiptId
      : null;
  }
  if (state.phase === 'reading') return state.receiptId;
  if (state.phase === 'ready') return state.receipt.id;
  return null;
}
