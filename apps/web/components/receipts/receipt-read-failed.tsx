'use client';

import { useTranslations } from 'next-intl';
import { CircleAlert } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

import type { ReaderFailure } from '@/lib/receipts/reader';

type ReadFailure = Extract<
  ReaderFailure,
  'readFailed' | 'timeout' | 'discarded' | 'alreadyConfirmed'
>;

/**
 * The photo went up but there is nothing to review: unreadable (or the OCR
 * service is down), too slow, discarded or already registered before.
 */
export function ReceiptReadFailed({
  reason,
  onManual,
  onOtherPhoto,
  onKeepWaiting,
  onClose,
}: {
  reason: ReadFailure;
  onManual: () => void;
  onOtherPhoto: () => void;
  onKeepWaiting: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('receipts');
  return (
    <div className="flex flex-col gap-4">
      <p
        role="alert"
        className="flex items-start gap-2 rounded-xl bg-track p-3 text-sm text-on-background"
      >
        <CircleAlert
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-on-surface-variant"
        />
        {t(`failed.${reason}`)}
      </p>
      <div className="flex flex-col gap-2">
        {reason === 'alreadyConfirmed' ? (
          <Button type="button" onClick={onClose}>
            {t('actions.close')}
          </Button>
        ) : (
          <Button type="button" onClick={onManual}>
            {t('actions.manual')}
          </Button>
        )}
        {reason === 'timeout' ? (
          <Button type="button" variant="outline" onClick={onKeepWaiting}>
            {t('actions.keepWaiting')}
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onOtherPhoto}>
          {t('actions.otherPhoto')}
        </Button>
      </div>
    </div>
  );
}
