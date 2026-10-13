/**
 * Uploads a transaction attachment through this site's file proxy
 * (POST /api/files/transactions/{id}/attachments, multipart `file`), with
 * upload progress. XMLHttpRequest because fetch can't report it.
 */
export class AttachmentUploadError extends Error {
  constructor(
    /** HTTP status, or 0 when there was no response. */
    readonly status: number,
  ) {
    super(`Attachment upload failed (${status})`);
    this.name = 'AttachmentUploadError';
  }
}

export function attachmentUploadUrl(transactionId: string): string {
  return `/api/files/transactions/${encodeURIComponent(transactionId)}/attachments`;
}

export function uploadAttachment(
  transactionId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', attachmentUploadUrl(transactionId));
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
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new AttachmentUploadError(xhr.status));
      }
    };
    xhr.onerror = () => reject(new AttachmentUploadError(0));
    xhr.ontimeout = () => reject(new AttachmentUploadError(0));
    const body = new FormData();
    body.append('file', file, file.name);
    xhr.send(body);
  });
}
