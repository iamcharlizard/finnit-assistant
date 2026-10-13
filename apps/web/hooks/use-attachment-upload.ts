'use client';

import * as React from 'react';

import { uploadErrorKey, type UploadErrorKey } from '@/lib/new-entry/errors';
import {
  AttachmentUploadError,
  uploadAttachment,
} from '@/lib/new-entry/upload';

export type AttachmentUploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number }
  | { status: 'done' }
  | { status: 'error'; errorKey: UploadErrorKey };

/** Uploads one attachment to a transaction, with progress and retry. */
export function useAttachmentUpload() {
  const [state, setState] = React.useState<AttachmentUploadState>({
    status: 'idle',
  });

  const upload = React.useCallback(
    async (transactionId: string, file: File): Promise<boolean> => {
      setState({ status: 'uploading', progress: 0 });
      try {
        await uploadAttachment(transactionId, file, (progress) =>
          setState({ status: 'uploading', progress }),
        );
        setState({ status: 'done' });
        return true;
      } catch (error) {
        setState({
          status: 'error',
          errorKey: uploadErrorKey(
            error instanceof AttachmentUploadError ? error.status : 0,
          ),
        });
        return false;
      }
    },
    [],
  );

  const reset = React.useCallback(() => setState({ status: 'idle' }), []);
  return { state, upload, reset };
}
