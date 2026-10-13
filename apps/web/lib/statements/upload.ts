/**
 * Uploads a card statement PDF through this site's file proxy
 * (POST /api/files/statements, multipart `file` + `accountId`). The API
 * answers 202 with the import (the same one when the file was uploaded
 * before) and extracts it in the background.
 */
export const STATEMENT_ACCEPT = 'application/pdf,.pdf';

export class StatementUploadError extends Error {
  constructor(
    /** HTTP status, or 0 when there was no response. */
    readonly status: number,
    /** The API's message, when it sent one. */
    readonly apiMessage: string | null = null,
  ) {
    super(`Statement upload failed (${status})`);
    this.name = 'StatementUploadError';
  }
}

export type StatementUploadErrorKey =
  | 'network'
  | 'tooLarge'
  | 'notPdf'
  | 'notCredit'
  | 'accountNotFound'
  | 'failed';

/** Message key (under `statements.uploadErrors`) for a failed upload. */
export function statementUploadErrorKey(
  status: number,
  apiMessage: string | null,
): StatementUploadErrorKey {
  if (status === 0) return 'network';
  if (status === 413) return 'tooLarge';
  const message = apiMessage ?? '';
  if (/exceeds 10 MB|too large/i.test(message)) return 'tooLarge';
  if (/not a PDF/i.test(message)) return 'notPdf';
  if (/only be imported for credit cards/i.test(message)) return 'notCredit';
  if (status === 404 || /account not found/i.test(message)) {
    return 'accountNotFound';
  }
  if (status === 400 || status === 415 || status === 422) return 'notPdf';
  return 'failed';
}

/** Nest errors: { message: string | string[] }. */
export function apiErrorText(body: unknown): string | null {
  const message = (body as { message?: unknown } | null)?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && typeof message[0] === 'string') {
    return message[0];
  }
  return null;
}

export async function uploadStatement(
  accountId: string,
  file: File,
): Promise<{ id: string }> {
  const body = new FormData();
  body.append('accountId', accountId);
  body.append('file', file, file.name);
  let response: Response;
  try {
    response = await fetch('/api/files/statements', { method: 'POST', body });
  } catch {
    throw new StatementUploadError(0);
  }
  if (response.status === 401) {
    window.location.assign(
      `/login?next=${encodeURIComponent(window.location.pathname)}`,
    );
  }
  const json: unknown = await response.json().catch(() => null);
  const id = (json as { id?: unknown } | null)?.id;
  if (!response.ok || typeof id !== 'string') {
    throw new StatementUploadError(response.status, apiErrorText(json));
  }
  return { id };
}
