'use client';

import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

import type { SuggestionItem } from '@/lib/budgets/view';
import { CategoryTile } from './category-tile';

/** Caps suggested from the last months' average spending. */
export function SuggestionsCard({
  suggestions,
  total,
  months,
  busy,
  onUse,
}: {
  suggestions: SuggestionItem[];
  total: string;
  months: number;
  busy: boolean;
  onUse: () => void;
}) {
  const t = useTranslations('budgets.suggestions');
  if (suggestions.length === 0) return null;
  return (
    <section className="flex flex-col gap-4 rounded-card border border-outline bg-surface p-5">
      <div className="flex items-start gap-3">
        <Sparkles
          aria-hidden
          className="mt-0.5 size-5 shrink-0 text-violet-ink"
        />
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-bold text-on-background">
            {t('title')}
          </h2>
          <p className="text-sm text-on-surface-variant">
            {t('description', { count: months })}
          </p>
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-outline">
        {suggestions.map((s) => (
          <li key={s.categoryId} className="flex items-center gap-3 py-2.5">
            <CategoryTile
              iconKey={s.iconKey}
              color={s.color}
              className="size-9"
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-on-background">
                {s.name}
              </span>
              <span className="text-xs text-on-surface-variant">
                {t('average', { amount: s.averageLabel })}
              </span>
            </div>
            <span className="text-sm font-bold text-on-background tabular-nums">
              {s.capLabel}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline pt-3">
        <span className="text-sm text-on-surface-variant">
          {t('total', { amount: total })}
        </span>
        <Button
          type="button"
          variant="secondary"
          onClick={onUse}
          disabled={busy}
        >
          {t('use')}
        </Button>
      </div>
    </section>
  );
}
