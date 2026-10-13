'use client';

import { useTranslations } from 'next-intl';
import { Info, X } from 'lucide-react';

/** A kind, dismissible note (e.g. the AI didn't answer). */
export function AiNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const t = useTranslations('categorize');
  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-card bg-track p-3 text-sm text-on-background"
    >
      <Info
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-on-surface-variant"
      />
      <p className="flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('dismiss')}
        className="-m-2 flex size-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
