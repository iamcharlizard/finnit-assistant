'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@finnit/ui/components/ui/dialog';

import { dayKeyOf, shortDate } from '@/lib/finance/dates';
import { formatMoney } from '@/lib/finance/money';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import {
  findCandidates,
  statementErrorMessage,
  type LinkCandidate,
} from '@/lib/statements/api';
import type { StatementLineView } from '@/lib/statements/view';

/**
 * "Vincular con un movimiento": movements on the same card with the same
 * amount, up to 3 days around the line's date (similarTransactions). Picking
 * one marks the line as already registered.
 */
export function LinkTransactionDialog({
  accountId,
  line,
  currency,
  onClose,
  onPick,
}: {
  accountId: string;
  line: StatementLineView;
  currency: string;
  onClose: () => void;
  onPick: (transactionId: string) => void;
}) {
  const { t } = useLocalizer();
  const tl = useTranslations('statements.linkDialog');
  const locale = useLocale() as 'es' | 'en';
  const [candidates, setCandidates] = React.useState<LinkCandidate[] | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    findCandidates(accountId, line, gql)
      .then((found) => !cancelled && setCandidates(found))
      .catch(
        (e: unknown) => !cancelled && setError(statementErrorMessage(e, t)),
      );
    return () => {
      cancelled = true;
    };
  }, [accountId, line, t]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tl('title')}</DialogTitle>
          <DialogDescription>
            {tl('description', {
              amount: formatMoney(line.rawAmount, currency, locale),
              date: line.date,
            })}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        ) : candidates === null ? (
          <p className="text-sm text-on-surface-variant" aria-live="polite">
            {tl('searching')}
          </p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-on-surface-variant">{tl('empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {candidates.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-outline p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-medium text-on-background">
                    {c.isPrivate ? (
                      <Lock
                        role="img"
                        aria-label={t('finance.private')}
                        className="size-3.5 shrink-0 text-on-surface-variant"
                      />
                    ) : null}
                    <span className="truncate">{c.displayName}</span>
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {shortDate(dayKeyOf(c.txnDate), locale)} ·{' '}
                    {formatMoney(c.amount, c.currency, locale)}
                  </p>
                </div>
                <Button size="sm" onClick={() => onPick(c.id)}>
                  {tl('choose')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
