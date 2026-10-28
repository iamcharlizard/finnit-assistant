'use client';

import { useTranslations } from 'next-intl';
import { QrCode, ScanText, Sparkles, TriangleAlert } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';

import type { ReceiptImport } from '@/lib/receipts/graphql';
import { readSourceKey } from '@/lib/receipts/prefill';
import { ReceiptThumbnail } from './receipt-thumbnail';

const SOURCE_ICONS = { qr: QrCode, ocr: ScanText, ai: Sparkles } as const;

/**
 * On top of the expense form once a receipt was read: the photo, how it was
 * read and how sure we are, and a way to discard it.
 */
export function ReceiptSummary({
  receipt,
  needsCheck,
  busy,
  onDiscard,
}: {
  receipt: ReceiptImport;
  /** Some fields are highlighted for a second look. */
  needsCheck: boolean;
  busy: boolean;
  onDiscard: () => void;
}) {
  const t = useTranslations('receipts');
  const source = readSourceKey(receipt.route);
  const SourceIcon = source ? SOURCE_ICONS[source] : null;
  const confidence = receipt.confidence;

  return (
    <div className="flex gap-3 rounded-xl border border-outline bg-surface p-3">
      <ReceiptThumbnail receiptId={receipt.id} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {source && SourceIcon ? (
            <Badge variant="muted" className="normal-case tracking-normal">
              <SourceIcon aria-hidden />
              {t(`source.${source}`)}
            </Badge>
          ) : null}
          {confidence ? (
            <Badge
              variant={confidence === 'high' ? 'success' : 'outline'}
              className={
                confidence === 'low'
                  ? 'border-amber-500/60 normal-case tracking-normal text-amber-700 dark:text-amber-300'
                  : 'normal-case tracking-normal'
              }
            >
              {t(`confidence.${confidence}`)}
            </Badge>
          ) : null}
        </div>
        {needsCheck ? (
          <p className="flex items-start gap-1 text-xs text-on-surface-variant">
            <TriangleAlert
              aria-hidden
              className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
            />
            {t('checkFields')}
          </p>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={onDiscard}
          className="-ml-2 self-start text-on-surface-variant"
        >
          {t('discard')}
        </Button>
      </div>
    </div>
  );
}
