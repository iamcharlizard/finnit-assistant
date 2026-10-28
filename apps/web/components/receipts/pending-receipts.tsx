'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';

import { shortDate } from '@/lib/finance/dates';
import { formatMoney } from '@/lib/finance/money';
import type { ReceiptImport } from '@/lib/receipts/graphql';
import { receiptDayKey } from '@/lib/receipts/prefill';
import { ReceiptThumbnail } from './receipt-thumbnail';

/** "Tickets pendientes": receipts read but not confirmed, to pick up again. */
export function PendingReceipts({
  receipts,
  onResume,
}: {
  receipts: ReceiptImport[];
  onResume: (receipt: ReceiptImport) => void;
}) {
  const t = useTranslations('receipts');
  const locale = useLocale();
  if (receipts.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-on-surface-variant uppercase">
        {t('pending.title')}
      </h3>
      <ul className="flex flex-col gap-2">
        {receipts.map((receipt) => {
          const name = receipt.merchantName?.trim() || t('pending.noMerchant');
          const day = receiptDayKey(receipt.date);
          const details = [
            day ? shortDate(day, locale) : null,
            receipt.total !== null
              ? formatMoney(receipt.total, receipt.currency, locale)
              : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <li key={receipt.id} className="flex items-center gap-3">
              <ReceiptThumbnail receiptId={receipt.id} />
              <button
                type="button"
                onClick={() => onResume(receipt)}
                aria-label={t('pending.resume', { name })}
                className="flex min-h-16 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-on-background">
                    {name}
                  </span>
                  {details ? (
                    <span className="block text-xs text-on-surface-variant">
                      {details}
                    </span>
                  ) : null}
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-4 shrink-0 text-on-surface-variant"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
