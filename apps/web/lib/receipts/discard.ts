import type { ReceiptStatus } from './graphql';
import { RECEIPT_POLL_INTERVAL_MS, isReading } from './reader';

/**
 * Discards an import nobody will review (reading cancelled, entered by hand
 * instead). The API refuses while the photo is still being read, so this
 * waits for the read to end first. Never throws: on failure the import just
 * stays (failed, or listed under "Tickets pendientes").
 */
export interface DiscardDeps {
  fetchStatus: (receiptId: string) => Promise<ReceiptStatus>;
  discard: (receiptId: string) => Promise<unknown>;
  wait: (ms: number) => Promise<void>;
}

export async function discardWhenSettled(
  receiptId: string,
  deps: DiscardDeps,
  { interval = RECEIPT_POLL_INTERVAL_MS, maxAttempts = 60 } = {},
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let status: ReceiptStatus;
    try {
      status = await deps.fetchStatus(receiptId);
    } catch {
      return false;
    }
    if (status === 'discarded') return true;
    if (status === 'confirmed') return false;
    if (!isReading(status)) {
      try {
        await deps.discard(receiptId);
        return true;
      } catch {
        return false;
      }
    }
    await deps.wait(interval);
  }
  return false;
}
