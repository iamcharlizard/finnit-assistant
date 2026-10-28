'use client';

import { useTranslations } from 'next-intl';
import { Camera } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { FileDropzone } from '@finnit/ui/components/ui/file-dropzone';
import { Progress } from '@finnit/ui/components/ui/progress';

import { MAX_UPLOAD_BYTES } from '@/lib/files/routes';
import type { ReaderState } from '@/lib/receipts/reader';
import {
  RECEIPT_ACCEPT,
  type ReceiptUploadErrorKey,
} from '@/lib/receipts/upload';

/**
 * "Capturar ticket": take a photo (the camera opens on phones) or pick an
 * image; it goes up right away. An upload error shows under the picker so
 * another photo can be tried, or the expense entered by hand.
 */
export function ReceiptCapture({
  state,
  file,
  onPick,
  onManual,
}: {
  state: ReaderState;
  file: File | null;
  onPick: (file: File) => void;
  onManual: () => void;
}) {
  const t = useTranslations('receipts');
  const uploading = state.phase === 'uploading';
  const uploadError: ReceiptUploadErrorKey | null =
    state.phase === 'failed' && state.receiptId === null
      ? (state.reason as ReceiptUploadErrorKey)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 text-sm text-on-surface-variant">
        <Camera aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t('picker.tips')}
      </p>
      <FileDropzone
        accept={RECEIPT_ACCEPT}
        capture="environment"
        maxSizeBytes={MAX_UPLOAD_BYTES}
        value={file && uploading ? [file] : []}
        onChange={(files) => {
          if (files[0]) onPick(files[0]);
        }}
        disabled={uploading}
        error={uploadError ? t(`errors.${uploadError}`) : undefined}
        title={t('picker.title')}
        description={t('picker.hint')}
        dragActiveText={t('picker.dragActive')}
        removeLabel={(name) => t('picker.remove', { name })}
        tooLargeText={(name, max) => t('picker.tooLarge', { name, max })}
        wrongTypeText={(name) => t('picker.wrongType', { name })}
        className="[&>button]:min-h-40 [&>button]:py-6"
      />
      {uploading ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <div className="flex items-center gap-2">
            <Progress
              value={state.progress}
              aria-label={t('uploading')}
              className="flex-1"
            />
            <span className="text-xs text-on-surface-variant tabular-nums">
              {t('progress', { percent: state.progress })}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant">{t('uploading')}</p>
        </div>
      ) : null}
      {uploadError ? (
        <Button type="button" variant="outline" onClick={onManual}>
          {t('actions.manual')}
        </Button>
      ) : null}
    </div>
  );
}
