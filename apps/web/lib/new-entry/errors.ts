import { GraphqlRequestError, NETWORK_ERROR } from '@/lib/graphql/client';

/**
 * Friendly messages (keys under `newEntry.errors`) for what can go wrong
 * while creating a movement or uploading its attachment.
 */
export type CreateErrorKey =
  | 'network'
  | 'sessionEnded'
  | 'insufficientBalance'
  | 'sameAccount'
  | 'currencyMismatch'
  | 'notFound'
  | 'invalid'
  | 'createFailed';

export function createErrorKey(error: unknown): CreateErrorKey {
  if (!(error instanceof GraphqlRequestError)) return 'createFailed';
  switch (error.code) {
    case NETWORK_ERROR:
      return 'network';
    case 'UNAUTHENTICATED':
      return 'sessionEnded';
    case 'INSUFFICIENT_BALANCE':
      return 'insufficientBalance';
    case 'TRANSFER_SAME_ACCOUNT':
      return 'sameAccount';
    case 'NOT_FOUND':
      return 'notFound';
    case 'VALIDATION_ERROR':
    case 'BAD_USER_INPUT':
    case 'BAD_REQUEST':
      return /currenc/i.test(error.message) ? 'currencyMismatch' : 'invalid';
    default:
      return 'createFailed';
  }
}

/** Files the attachment picker takes (the API checks the bytes too). */
export const ATTACHMENT_ACCEPT =
  'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf,.pdf';

export type UploadErrorKey =
  | 'uploadNetwork'
  | 'uploadTooLarge'
  | 'uploadInvalid'
  | 'uploadFailed';

/** Message for a failed upload, from the HTTP status (0 = no response). */
export function uploadErrorKey(status: number): UploadErrorKey {
  if (status === 0) return 'uploadNetwork';
  if (status === 413) return 'uploadTooLarge';
  if (status === 400 || status === 415 || status === 422) {
    return 'uploadInvalid';
  }
  return 'uploadFailed';
}
