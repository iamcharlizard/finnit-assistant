'use client';

import { useTranslations } from 'next-intl';
import { CalendarClock, Check, Sparkles } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';

import type { CandidateRow } from '@finnit/core/debts/detail-view';

export type CandidatesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; rows: CandidateRow[] };

/** Bank movements that look like open payments; one click links them. */
export function LoanCandidates({
  state,
  busy,
  onRetry,
  onConfirm,
}: {
  state: CandidatesState;
  busy: string | null;
  onRetry: () => void;
  onConfirm: (row: CandidateRow) => void;
}) {
  const td = useTranslations('debts.detail');
  if (state.status === 'ready' && state.rows.length === 0) return null;
  return (
    <section
      aria-labelledby="loan-candidates"
      aria-busy={state.status === 'loading'}
      className="flex flex-col gap-3 rounded-card border border-dashed border-accent-neon/50 bg-accent-neon/5 p-4"
    >
      <h2
        id="loan-candidates"
        className="flex items-center gap-2 text-base font-bold text-on-background"
      >
        <CalendarClock aria-hidden className="size-5" />
        {td('candidatesTitle')}
      </h2>
      {state.status === 'loading' ? (
        <p className="text-sm text-on-surface-variant">
          {td('candidatesLoading')}
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p role="alert" className="flex items-center gap-2 text-sm">
          {td('candidatesError')}
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            {td('retry')}
          </Button>
        </p>
      ) : null}
      {state.status === 'ready' ? (
        <>
          <p className="text-xs text-on-surface-variant">
            {td('candidatesHint')}
          </p>
          <ul className="flex flex-col gap-2">
            {state.rows.map((row) => (
              <li
                key={row.key}
                className="flex flex-wrap items-center gap-3 rounded-input bg-surface p-3"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-on-background">
                    {td('candidatePays', {
                      date: row.dueLabel,
                      amount: row.expectedLabel,
                    })}
                  </span>
                  <span className="truncate text-xs text-on-surface-variant">
                    {[
                      row.description,
                      row.accountName,
                      row.dateLabel,
                      row.amountLabel,
                    ].join(' · ')}
                  </span>
                </span>
                <Badge variant={row.reason === 'ai' ? 'brand' : 'muted'}>
                  {row.reason === 'ai' ? <Sparkles aria-hidden /> : null}
                  {td(`reasons.${row.reason}`)}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy === row.key}
                  onClick={() => onConfirm(row)}
                >
                  <Check aria-hidden /> {td('confirmCandidate')}
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
