'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CloudOff, SearchCheck } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

import { EmptyState } from '@/components/finance/empty-state';
import type { SuggestionsState } from '@/hooks/use-recurring-suggestions';
import { useLocalizer } from '@/lib/i18n/client';
import { toSuggestionCard } from '@/lib/recurring/suggestions';
import type { ApiRecurringSuggestion } from '@/lib/recurring/types';
import { SuggestionCard } from './suggestion-card';
import { SuggestionsSkeleton } from './suggestions-skeleton';

/** "Sugeridos": recurring payments found in the user's movements. */
export function SuggestionsSection({
  state,
  today,
  onRetry,
  onAdd,
  onDismiss,
}: {
  state: SuggestionsState;
  today: string;
  onRetry: () => void;
  onAdd: (suggestion: ApiRecurringSuggestion) => void;
  onDismiss: (suggestion: ApiRecurringSuggestion, index: number) => void;
}) {
  const l = useLocalizer();
  const t = useTranslations('recurring.suggestions');
  const cards = React.useMemo(
    () =>
      state.status === 'ready'
        ? state.items.map((s) => ({
            suggestion: s,
            card: toSuggestionCard(s, today, l),
          }))
        : [],
    [state, today, l],
  );

  return (
    <section
      aria-labelledby="recurring-suggestions-title"
      aria-busy={state.status === 'loading'}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-0.5">
        <h2
          id="recurring-suggestions-title"
          className="text-title-lg font-bold text-on-background"
        >
          {t('title')}
        </h2>
        <p className="text-xs text-on-surface-variant">{t('subtitle')}</p>
      </div>

      {state.status === 'loading' ? <SuggestionsSkeleton /> : null}

      {state.status === 'error' ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-2 rounded-card border border-dashed border-on-background/12 px-6 py-8 text-center"
        >
          <CloudOff aria-hidden className="size-8 text-on-surface-variant/50" />
          <p className="text-sm font-medium text-on-background">
            {t('loadError')}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t('retry')}
          </Button>
        </div>
      ) : null}

      {state.status === 'ready' && cards.length === 0 ? (
        <EmptyState icon={SearchCheck} title={t('empty')} className="py-8" />
      ) : null}

      {cards.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ suggestion, card }, index) => (
            <SuggestionCard
              key={card.fingerprint}
              card={card}
              onAdd={() => onAdd(suggestion)}
              onDismiss={() => onDismiss(suggestion, index)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
