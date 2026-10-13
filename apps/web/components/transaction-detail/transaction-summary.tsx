'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Lock } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import { Card } from '@finnit/ui/components/ui/card';
import { cn } from '@finnit/ui/lib/utils';

import type { TransactionDetailView } from '@/lib/transaction-detail/view';

const AMOUNT_COLOR = {
  income: 'text-income',
  expense: 'text-expense',
  neutral: 'text-on-background',
} as const;

/**
 * The movement's name (with a lock when private), amount and type. A
 * private movement hides its original text until "Ver original".
 */
export function TransactionSummary({ view }: { view: TransactionDetailView }) {
  const t = useTranslations();
  const [revealed, setRevealed] = React.useState(false);
  const originalId = React.useId();

  return (
    <Card className="gap-3 rounded-[20px] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted">{view.typeLabel}</Badge>
        {view.pending ? (
          <Badge variant="highlight">{t('finance.pending')}</Badge>
        ) : null}
        {view.isPrivate ? (
          <Badge variant="outline">
            <Lock aria-hidden /> {t('transaction.private')}
          </Badge>
        ) : null}
      </div>
      <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold break-words text-on-background">
        {view.isPrivate ? (
          <Lock
            role="img"
            aria-label={t('transaction.private')}
            className="size-5 shrink-0 text-on-surface-variant"
          />
        ) : null}
        <span className="min-w-0">{view.title}</span>
      </h1>
      <p
        className={cn(
          'text-[32px] leading-tight font-bold tabular-nums',
          AMOUNT_COLOR[view.variant],
        )}
      >
        {view.amount}
      </p>
      <p className="text-sm text-on-surface-variant">{view.dateLabel}</p>

      {view.isPrivate ? (
        <div className="flex flex-col gap-2 border-t border-glass-border pt-3">
          <p className="text-xs text-on-surface-variant">
            {t('transaction.privateHint')}
          </p>
          {view.original ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                aria-expanded={revealed}
                aria-controls={originalId}
                onClick={() => setRevealed((r) => !r)}
              >
                {revealed ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                {revealed
                  ? t('transaction.hideOriginal')
                  : t('transaction.showOriginal')}
              </Button>
              <p
                id={originalId}
                hidden={!revealed}
                className="rounded-input bg-track p-3 text-sm break-words text-on-background"
              >
                {view.original}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
