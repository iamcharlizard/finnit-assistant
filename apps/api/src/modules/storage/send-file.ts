import type { Response } from 'express';
import { StoredObject } from './s3-storage.service';

/**
 * Streams a private file to its owner. The response must never be cached by
 * browsers or proxies, and the type is fixed so the browser does not guess it.
 */
export function sendFile(
  res: Response,
  file: StoredObject,
  options: { fileName: string; contentType: string; inline?: boolean },
): void {
  res.setHeader('Content-Type', options.contentType);
  if (file.contentLength !== undefined) {
    res.setHeader('Content-Length', String(file.contentLength));
  }
  res.setHeader(
    'Content-Disposition',
    `${options.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(options.fileName)}`,
  );
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  file.body.on('error', () => res.destroy());
  file.body.pipe(res);
}
