'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ReceiptText } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@finnit/ui/components/ui/dialog';

import { receiptFileUrl } from '@/lib/receipts/upload';

/**
 * The receipt photo, small; tap to see it large. Served by the file proxy
 * (the API checks the owner). Browsers that can't decode it (e.g. HEIC
 * outside Safari) get an icon instead.
 */
export function ReceiptThumbnail({ receiptId }: { receiptId: string }) {
  const t = useTranslations('receipts');
  const tc = useTranslations('common');
  const [broken, setBroken] = React.useState(false);
  const src = receiptFileUrl(receiptId);

  if (!src || broken) {
    return (
      <div
        title={t('noPreview')}
        className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-track text-on-surface-variant"
      >
        <ReceiptText aria-hidden className="size-6" />
        <span className="sr-only">{t('noPreview')}</span>
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t('zoom')}
          className="size-16 shrink-0 overflow-hidden rounded-lg border border-outline bg-track outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- private file behind the authenticated proxy */}
          <img
            src={src}
            alt={t('photo')}
            onError={() => setBroken(true)}
            className="size-full object-cover"
          />
        </button>
      </DialogTrigger>
      <DialogContent
        closeLabel={tc('close')}
        className="max-w-2xl p-3 pt-14 sm:p-4 sm:pt-14"
      >
        <DialogTitle className="sr-only">{t('photo')}</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element -- private file behind the authenticated proxy */}
        <img
          src={src}
          alt={t('photo')}
          className="max-h-[75dvh] w-full rounded-lg object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
