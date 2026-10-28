'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Paperclip } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Card } from '@finnit/ui/components/ui/card';
import { FileDropzone } from '@finnit/ui/components/ui/file-dropzone';
import { Progress } from '@finnit/ui/components/ui/progress';
import { toast } from '@finnit/ui/components/ui/toaster';

import {
  ConfirmDialog,
  type ConfirmRequest,
} from '@/components/admin/confirm-dialog';
import { useAttachmentUpload } from '@/hooks/use-attachment-upload';
import { MAX_UPLOAD_BYTES } from '@/lib/files/routes';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { ATTACHMENT_ACCEPT } from '@/lib/new-entry/errors';
import {
  removeAttachment,
  transactionErrorMessage,
} from '@/lib/transaction-detail/api';
import type { AttachmentView } from '@/lib/transaction-detail/view';
import { AttachmentItem } from './attachment-item';

/** The movement's files: list, download, delete and upload one more. */
export function AttachmentsCard({
  transactionId,
  attachments,
}: {
  transactionId: string;
  attachments: AttachmentView[];
}) {
  const router = useRouter();
  const { t } = useLocalizer();
  const ta = useTranslations('transaction.attachments');
  const { state, upload, reset } = useAttachmentUpload();
  const [file, setFile] = React.useState<File | null>(null);
  const [removing, setRemoving] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const uploading = state.status === 'uploading';

  async function send() {
    if (!file) return;
    if (await upload(transactionId, file)) {
      setFile(null);
      reset();
      toast.success(t('transaction.toasts.attachmentUploaded'));
      router.refresh();
    }
  }

  function askRemove(attachment: AttachmentView) {
    setConfirm({
      title: ta('removeTitle'),
      description: ta('removeDescription', { name: attachment.name }),
      confirmLabel: t('transaction.delete'),
      destructive: true,
      onConfirm: () => {
        setConfirm(null);
        setRemoving(attachment.id);
        removeAttachment(attachment.id, gql)
          .then(() => {
            toast.success(t('transaction.toasts.attachmentRemoved'));
            router.refresh();
          })
          .catch((error: unknown) =>
            toast.error(transactionErrorMessage(error, t)),
          )
          .finally(() => setRemoving(null));
      },
    });
  }

  return (
    <Card className="gap-4 rounded-[20px] p-5">
      <h2 className="flex items-center gap-2 text-[11px] font-medium tracking-[0.15em] text-on-surface-variant uppercase">
        <Paperclip aria-hidden className="size-4 text-brand-ink" />
        {ta('title')}
      </h2>
      {attachments.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {attachments.map((attachment) => (
            <AttachmentItem
              key={attachment.id}
              attachment={attachment}
              busy={removing === attachment.id}
              onRemove={() => askRemove(attachment)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-on-surface-variant">{ta('empty')}</p>
      )}

      <FileDropzone
        accept={ATTACHMENT_ACCEPT}
        maxSizeBytes={MAX_UPLOAD_BYTES}
        value={file ? [file] : []}
        onChange={(files) => {
          setFile(files[0] ?? null);
          reset();
        }}
        disabled={uploading}
        error={
          state.status === 'error'
            ? t(`newEntry.errors.${state.errorKey}`)
            : undefined
        }
        title={ta('dropTitle')}
        description={ta('dropHint')}
        dragActiveText={ta('dragActive')}
        removeLabel={(name) => ta('removeFile', { name })}
        tooLargeText={(name, max) => ta('tooLarge', { name, max })}
        wrongTypeText={(name) => ta('wrongType', { name })}
        className="[&>button]:min-h-24 [&>button]:py-4"
      />
      {uploading ? (
        <div className="flex items-center gap-2" aria-live="polite">
          <Progress
            value={state.progress}
            aria-label={ta('uploading', { percent: state.progress })}
            className="flex-1"
          />
          <span className="text-xs text-on-surface-variant tabular-nums">
            {ta('uploading', { percent: state.progress })}
          </span>
        </div>
      ) : null}
      {file ? (
        <Button onClick={() => void send()} disabled={uploading}>
          {ta('upload')}
        </Button>
      ) : null}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </Card>
  );
}
