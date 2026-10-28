'use client';

import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

/** "Leyendo tu ticket…" while the server reads the photo. */
export function ReceiptReading({ onCancel }: { onCancel: () => void }) {
  const t = useTranslations('receipts');
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <Loader2
        aria-hidden
        className="size-8 animate-spin text-brand-ink motion-reduce:animate-none"
      />
      <div role="status" aria-live="polite">
        <p className="text-base font-medium text-on-background">
          {t('reading')}
        </p>
        <p className="text-sm text-on-surface-variant">{t('readingHint')}</p>
      </div>
      <Button type="button" variant="ghost" onClick={onCancel}>
        {t('cancel')}
      </Button>
    </div>
  );
}
