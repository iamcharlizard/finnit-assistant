import { API_ORIGIN } from '@/lib/api/config';
import { graphqlClient } from '@/lib/graphql/client';
import { readItem } from '@/lib/session/storage';

/** A picked file: a local URI (camera, photo library, document picker). */
export interface LocalFile {
  uri: string;
  name: string;
  mimeType: string;
}

export class UploadError extends Error {
  constructor(
    /** HTTP status, or 0 without a response. */
    readonly status: number,
  ) {
    super(`Upload failed (${status})`);
    this.name = 'UploadError';
  }
}

async function post(path: string, file: LocalFile, fields: Record<string, string>): Promise<Response> {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  // React Native's FormData takes { uri, name, type } for files.
  body.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  const token = readItem('accessToken');
  return fetch(`${API_ORIGIN}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  });
}

/**
 * Uploads a file to one of the API's REST endpoints (multipart `file`,
 * Bearer token): receipts, screenshots, statements, a movement's
 * attachments. A 401 renews the session once (through the GraphQL client)
 * and retries. Returns the JSON body.
 */
export async function uploadFile<T>(
  path: '/receipts' | '/screenshots' | '/statements' | `/transactions/${string}/attachments`,
  file: LocalFile,
  /** Other multipart fields (e.g. a statement's accountId). */
  fields: Record<string, string> = {},
): Promise<T> {
  let response: Response;
  try {
    response = await post(path, file, fields);
    if (response.status === 401) {
      // Any authenticated query makes the auth exchange refresh the tokens.
      await graphqlClient.query('query Me { me { id } }', {}, { requestPolicy: 'network-only' }).toPromise();
      response = await post(path, file, fields);
    }
  } catch {
    throw new UploadError(0);
  }
  if (!response.ok) throw new UploadError(response.status);
  return (await response.json()) as T;
}
