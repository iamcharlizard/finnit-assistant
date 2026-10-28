'use client';

import { useTranslations } from 'next-intl';
import { Check, Sparkles, X } from 'lucide-react';

const ACTION =
  'flex size-9 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50';

/** "Sugerencia: Restaurantes ✓ ✕" under a row with a pending AI suggestion. */
export function SuggestionChip({
  label,
  busy,
  onAccept,
  onReject,
}: {
  label: string;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const t = useTranslations('categorize');
  return (
    <div className="flex w-fit max-w-full items-center gap-1 rounded-full bg-accent-neon/12 py-0.5 pr-1 pl-3 text-xs text-on-background">
      <Sparkles aria-hidden className="size-3.5 shrink-0 text-violet-ink" />
      <span className="truncate">{t('suggestion', { category: label })}</span>
      <button
        type="button"
        className={`${ACTION} text-income hover:bg-income/10`}
        aria-label={t('acceptSuggestion', { category: label })}
        disabled={busy}
        onClick={onAccept}
      >
        <Check aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        className={`${ACTION} text-on-surface-variant hover:bg-expense/10 hover:text-expense`}
        aria-label={t('rejectSuggestion', { category: label })}
        disabled={busy}
        onClick={onReject}
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
