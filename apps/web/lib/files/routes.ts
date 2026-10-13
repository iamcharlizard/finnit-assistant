/**
 * What /api/files/* may forward to the API's REST file endpoints. Anything
 * not listed here is a 404: the proxy never builds an upstream URL from
 * unchecked input (each path is rebuilt from these literals plus a UUID).
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Content-Length above this is rejected before reading (multipart overhead). */
export const MAX_REQUEST_BYTES = 10.5 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FileRoute =
  | { kind: 'upload'; upstreamPath: string }
  | { kind: 'download'; upstreamPath: string };

/** Kinds of stored file that can be downloaded by id. */
const DOWNLOADS = ['statements', 'attachments', 'receipts'] as const;
/** Upload endpoints without an id in the path. */
const UPLOADS = ['statements', 'receipts'] as const;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/**
 * The API endpoint for a method and the path after /api/files/, or null.
 * - POST statements | receipts
 * - POST transactions/{uuid}/attachments
 * - GET  statements|attachments|receipts/{uuid}/file
 */
export function matchFileRoute(
  method: string,
  segments: ReadonlyArray<string>,
): FileRoute | null {
  const [first, id, last, ...extra] = segments;
  if (extra.length) return null;

  if (method === 'POST') {
    if (
      segments.length === 1 &&
      (UPLOADS as readonly string[]).includes(first!)
    ) {
      return { kind: 'upload', upstreamPath: `/${first}` };
    }
    if (
      segments.length === 3 &&
      first === 'transactions' &&
      isUuid(id) &&
      last === 'attachments'
    ) {
      return {
        kind: 'upload',
        upstreamPath: `/transactions/${id.toLowerCase()}/attachments`,
      };
    }
    return null;
  }

  if (method === 'GET' || method === 'HEAD') {
    if (
      segments.length === 3 &&
      (DOWNLOADS as readonly string[]).includes(first!) &&
      isUuid(id) &&
      last === 'file'
    ) {
      return {
        kind: 'download',
        upstreamPath: `/${first}/${id.toLowerCase()}/file`,
      };
    }
  }
  return null;
}

/** True when a Content-Length header announces more than the limit. */
export function exceedsRequestLimit(
  contentLength: string | null,
  limit = MAX_REQUEST_BYTES,
): boolean {
  if (contentLength === null) return false;
  const bytes = Number(contentLength);
  return !Number.isFinite(bytes) || bytes < 0 || bytes > limit;
}

/**
 * Passes a request body through, failing once more than `limit` bytes went
 * by (for bodies sent without Content-Length, e.g. chunked).
 */
export function limitStream(
  body: ReadableStream<Uint8Array>,
  limit = MAX_REQUEST_BYTES,
): ReadableStream<Uint8Array> {
  let seen = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > limit) {
          controller.error(new PayloadTooLargeError());
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

export class PayloadTooLargeError extends Error {
  constructor() {
    super('Request body too large');
    this.name = 'PayloadTooLargeError';
  }
}

/** Response headers the browser gets from the API for a file. */
export const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-disposition',
  'last-modified',
  'etag',
] as const;
