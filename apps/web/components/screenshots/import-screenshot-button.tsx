'use client';

import { useTranslations } from 'next-intl';
import { Smartphone } from 'lucide-react';

/** "Importar captura": a first-step shortcut of Nuevo movimiento. */
export function ImportScreenshotButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations('screenshots');
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-outline p-3 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-track">
        <Smartphone aria-hidden className="size-5 text-brand-ink" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-on-background">
          {t('import')}
        </span>
        <span className="block text-xs text-on-surface-variant">
          {t('importHint')}
        </span>
      </span>
    </button>
  );
}
