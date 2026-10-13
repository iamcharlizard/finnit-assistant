'use client';

import { useTranslations } from 'next-intl';
import { Plus, Sparkles, X } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';

import type { SuggestionCard as SuggestionCardData } from '@/lib/recurring/suggestions';
import { KindIcon } from './kind-icon';
import { SuggestionEvidence } from './suggestion-evidence';

/** A detected recurring payment: what we found and add / dismiss. */
export function SuggestionCard({
  card,
  onAdd,
  onDismiss,
}: {
  card: SuggestionCardData;
  onAdd: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations();
  const facts = [
    card.accountLabel,
    card.categoryLabel,
    t(`finance.recurringKinds.${card.kind}`),
  ].filter(Boolean);
  return (
    <li className="flex flex-col gap-3 rounded-card border border-dashed border-accent-neon/50 bg-accent-neon/5 p-4">
      <div className="flex items-start gap-3">
        <KindIcon kind={card.kind} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="truncate text-base font-bold text-on-background">
            {card.name}
          </h3>
          <p className="truncate text-xs text-on-surface-variant">
            {card.merchant}
          </p>
        </div>
        {card.classifiedByAi ? (
          <Badge variant="brand" className="shrink-0">
            <Sparkles aria-hidden /> {t('recurring.suggestions.ai')}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xl font-bold text-on-background tabular-nums">
            {card.amountLabel}
          </span>
          <span className="text-xs text-on-surface-variant">
            {card.frequencyLabel} ·{' '}
            {t('recurring.suggestions.nextDue', { date: card.nextDueLabel })}
          </span>
        </div>
        {card.isVariableAmount ? (
          <Badge variant="highlight">
            {t('recurring.suggestions.variable')}
          </Badge>
        ) : null}
      </div>

      <p className="text-xs text-on-surface-variant">{facts.join(' · ')}</p>

      <SuggestionEvidence evidence={card.evidence} />

      <div className="flex items-center justify-between gap-2 border-t border-outline pt-3">
        <span className="text-[11px] whitespace-nowrap text-on-surface-variant/80">
          {t('recurring.suggestions.confidence', {
            percent: card.confidence,
          })}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            aria-label={t('recurring.suggestions.dismissLabel', {
              name: card.name,
            })}
          >
            <X aria-hidden /> {t('recurring.suggestions.dismiss')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onAdd}
            aria-label={t('recurring.suggestions.addLabel', {
              name: card.name,
            })}
          >
            <Plus aria-hidden /> {t('recurring.suggestions.add')}
          </Button>
        </div>
      </div>
    </li>
  );
}
