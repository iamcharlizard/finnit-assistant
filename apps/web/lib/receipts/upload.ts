import { isUuid } from '@/lib/files/routes';
import type { ReceiptStatus } from './graphql';

/**
 * Uploads a receipt photo through this site's file proxy
 * (POST /api/files/receipts, multipart `file`), with upload progress. The
 * API answers 202 with the import (the same one when the photo was uploaded
 * before) and reads it in the background. XMLHttpRequest because fetch
 * can't report upload progress.
 */

/** The picker takes any image (the camera on phones); the API checks the bytes. */
export const RECEIPT_ACCEPT = 'image/*';

export class ReceiptUploadError extends Error {
  constructor(
    /** HTTP status, or 0 when there was no response. */
    readonly status: number,
  ) {
    super(`Receipt upload failed (${status})`);
    this.name = 'ReceiptUploadError';
  }
}

export type ReceiptUploadErrorKey =
  | 'uploadNetwork'
  | 'uploadTooLarge'
  | 'uploadInvalid'
  | 'uploadFailed';

/** Message key (under `receipts.errors`) for a failed upload. */
export function receiptUploadErrorKey(status: number): ReceiptUploadErrorKey {
  if (status === 0) return 'uploadNetwork';
  if (status === 413) return 'uploadTooLarge';
  if (status === 400 || status === 415 || status === 422) {
    return 'uploadInvalid';
  }
  return 'uploadFailed';
}

/** The photo of a receipt, through the authenticated file proxy. */
export function receiptFileUrl(receiptId: string): string | null {
  return isUuid(receiptId)
    ? `/api/files/receipts/${receiptId.toLowerCase()}/file`
    : null;
}

export interface UploadedReceipt {
  id: string;
  status: ReceiptStatus;
}

/** The 202 body, or null when it isn't one. */
export function parseUploadResponse(text: string): UploadedReceipt | null {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  const { id, status } = (body ?? {}) as { id?: unknown; status?: unknown };
  if (typeof id !== 'string' || typeof status !== 'string') return null;
  return { id, status: status as ReceiptStatus };
}

export function uploadReceipt(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedReceipt> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files/receipts');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status === 401) {
        window.location.assign(
          `/login?next=${encodeURIComponent(window.location.pathname)}`,
        );
      }
      const uploaded =
        xhr.status >= 200 && xhr.status < 300
          ? parseUploadResponse(xhr.responseText)
          : null;
      if (uploaded) {
        onProgress?.(100);
        resolve(uploaded);
      } else {
        reject(new ReceiptUploadError(xhr.status));
      }
    };
    xhr.onerror = () => reject(new ReceiptUploadError(0));
    xhr.ontimeout = () => reject(new ReceiptUploadError(0));
    const body = new FormData();
    body.append('file', file, file.name);
    xhr.send(body);
  });
}
