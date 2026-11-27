'use client';

import { useTranslations } from 'next-intl';
import { Layers } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

import type { MergeCandidate } from '@finnit/core/debts/api';

/**
 * "Ya tienes «Kuesi» con Kueski": a new purchase (or personal loan) with a
 * lender already registered can join that loan, so its payments add up;
 * the user may keep it apart. `chosen` is the loan it joins, 'separate',
 * or null while undecided (saved apart).
 */
export function MergeSuggestion({
  candidates,
  personal,
  chosen,
  onChoose,
}: {
  candidates: MergeCandidate[];
  personal: boolean;
  chosen: string | null;
  onChoose: (choice: string) => void;
}) {
  const t = useTranslations('debts.merge');
  if (candidates.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 rounded-input border border-brand-ink/30 bg-brand/5 p-3">
      {candidates.map((candidate) => (
        <div key={candidate.id} className="flex flex-col gap-2">
          <p className="flex items-start gap-2 text-sm font-medium">
            <Layers aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t('title', {
              name: candidate.name,
              lender: candidate.lenderName ?? '',
            })}
          </p>
          <p className="text-xs text-on-surface-variant">
            {t(personal ? 'personal' : 'purchase')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={chosen === candidate.id ? 'secondary' : 'outline'}
              aria-pressed={chosen === candidate.id}
              onClick={() => onChoose(candidate.id)}
            >
              {t('add')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={chosen === 'separate' ? 'secondary' : 'outline'}
              aria-pressed={chosen === 'separate'}
              onClick={() => onChoose('separate')}
            >
              {t('separate')}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
