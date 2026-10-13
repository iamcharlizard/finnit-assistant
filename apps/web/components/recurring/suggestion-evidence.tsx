'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';

import { cn } from '@finnit/ui/lib/utils';

import type { SuggestionCard } from '@/lib/recurring/suggestions';

/** The movements a suggestion was detected from, collapsed by default. */
export function SuggestionEvidence({
  evidence,
}: {
  evidence: SuggestionCard['evidence'];
}) {
  const t = useTranslations('recurring.suggestions');
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-9 items-center gap-1 self-start rounded-lg text-xs font-medium text-on-surface-variant outline-none hover:text-on-background focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ChevronDown
          aria-hidden
          className={cn('size-4 transition-transform', open && 'rotate-180')}
        />
        {t('evidence', { count: evidence.length })}
      </button>
      {open ? (
        <ul
          id={listId}
          className="flex flex-col divide-y divide-outline rounded-input bg-muted/50 px-3 text-xs"
        >
          {evidence.map((row) => (
            <li key={row.key} className="flex justify-between gap-3 py-1.5">
              <span className="text-on-surface-variant">{row.dateLabel}</span>
              <span className="font-medium text-on-background tabular-nums">
                {row.amountLabel}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
