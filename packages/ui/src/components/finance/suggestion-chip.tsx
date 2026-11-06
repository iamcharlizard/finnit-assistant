'use client';

import { Check, Sparkles, X } from 'lucide-react';

import { cn } from '../../lib/utils';

const ACTION =
  'flex size-9 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50';

interface SuggestionChipProps {
  /** E.g. "Sugerencia: Supermercado". */
  text: string;
  acceptLabel: string;
  rejectLabel: string;
  busy?: boolean;
  onAccept: () => void;
  onReject: () => void;
  className?: string;
}

/** A pending category suggestion with accept (✓) and reject (✕). */
function SuggestionChip({
  text,
  acceptLabel,
  rejectLabel,
  busy = false,
  onAccept,
  onReject,
  className,
}: SuggestionChipProps) {
  return (
    <div
      className={cn(
        'flex w-fit max-w-full items-center gap-1 rounded-full bg-accent-neon/12 py-0.5 pr-1 pl-3 text-xs text-on-background',
        className,
      )}
    >
      <Sparkles aria-hidden className="size-3.5 shrink-0 text-violet-ink" />
      <span className="truncate">{text}</span>
      <button
        type="button"
        className={cn(ACTION, 'text-income hover:bg-income/10')}
        aria-label={acceptLabel}
        disabled={busy}
        onClick={onAccept}
      >
        <Check aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        className={cn(
          ACTION,
          'text-on-surface-variant hover:bg-expense/10 hover:text-expense',
        )}
        aria-label={rejectLabel}
        disabled={busy}
        onClick={onReject}
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}

export { SuggestionChip, type SuggestionChipProps };
