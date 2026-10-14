'use client';

import { useTranslations } from 'next-intl';
import { ScanLine } from 'lucide-react';

/**
 * Entry point to receipt capture: "Escanear ticket" as a first-step shortcut
 * (`variant="shortcut"`), "Capturar ticket" inside the expense form.
 */
export function ScanReceiptButton({
  variant,
  onClick,
}: {
  variant: 'shortcut' | 'inline';
  onClick: () => void;
}) {
  const t = useTranslations('receipts');
  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-outline px-3 py-2 text-sm font-medium text-brand-ink outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ScanLine aria-hidden className="size-4" />
        {t('capture')}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-outline p-3 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-track">
        <ScanLine aria-hidden className="size-5 text-expense" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-on-background">
          {t('scan')}
        </span>
        <span className="block text-xs text-on-surface-variant">
          {t('scanHint')}
        </span>
      </span>
    </button>
  );
}
