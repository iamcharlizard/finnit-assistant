'use client';

import { useTranslations } from 'next-intl';
import { CircleCheck, FileIcon } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Progress } from '@finnit/ui/components/ui/progress';

import type { AttachmentUploadState } from '@/hooks/use-attachment-upload';

/**
 * The receipt going up after the movement was created. If it fails the
 * movement stays created: retry, or close without the receipt.
 */
export function AttachmentUploadStatus({
  fileName,
  state,
  showCreated,
  onRetry,
  onSkip,
}: {
  fileName: string;
  state: AttachmentUploadState;
  /** The movement was just created (not an existing one). */
  showCreated: boolean;
  onRetry: () => void;
  onSkip: () => void;
}) {
  const t = useTranslations('newEntry');
  const progress = state.status === 'uploading' ? state.progress : 100;
  return (
    <div className="flex flex-col gap-4">
      {showCreated ? (
        <p className="flex items-center gap-2 text-sm text-on-background">
          <CircleCheck aria-hidden className="size-5 text-income" />
          {t('upload.created')}
        </p>
      ) : null}
      <div className="flex items-center gap-3 rounded-xl border border-outline bg-surface p-3">
        <FileIcon
          aria-hidden
          className="size-5 shrink-0 text-on-surface-variant"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-on-background">
            {fileName}
          </p>
          {state.status === 'error' ? (
            <p role="alert" className="text-xs text-expense">
              {t(`errors.${state.errorKey}`)}
            </p>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <Progress
                value={progress}
                aria-label={t('upload.uploading')}
                className="flex-1"
              />
              <span className="text-xs text-on-surface-variant tabular-nums">
                {t('upload.progress', { percent: progress })}
              </span>
            </div>
          )}
        </div>
      </div>
      {state.status === 'uploading' ? (
        <p aria-live="polite" className="text-xs text-on-surface-variant">
          {t('upload.uploading')}
        </p>
      ) : null}
      {state.status === 'error' ? (
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="button" onClick={onRetry} className="sm:flex-1">
            {t('upload.retry')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onSkip}
            className="sm:flex-1"
          >
            {t('upload.skip')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
