'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@finnit/ui/components/ui/button';

import { dayKeyOf, shortDate } from '@/lib/finance/dates';
import { formatMoney } from '@/lib/finance/money';
import type { SimilarTransaction } from '@/lib/new-entry/graphql';

/**
 * "¿Ya está registrado?" for a receipt: attach the photo to a movement that
 * is already there (e.g. synced from the bank) or register a new expense.
 */
export function ReceiptMatchReview({
  matches,
  busy,
  error,
  onAttach,
  onCreateNew,
}: {
  matches: SimilarTransaction[];
  busy: boolean;
  error: string | null;
  onAttach: (transactionId: string) => void;
  onCreateNew: () => void;
}) {
  const t = useTranslations('receipts');
  const tn = useTranslations('newEntry');
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-on-surface-variant">
        {t('match.description', { count: matches.length })}
      </p>
      <ul className="flex flex-col gap-2">
        {matches.map((match) => (
          <li
            key={match.id}
            className="flex flex-col gap-2 rounded-xl border border-outline bg-surface p-3 sm:flex-row sm:items-center sm:gap-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-on-background">
                {match.displayName ||
                  match.merchantName ||
                  match.description ||
                  tn('duplicates.noDescription')}
              </p>
              <p className="text-xs text-on-surface-variant">
                {shortDate(dayKeyOf(match.txnDate), locale)} ·{' '}
                {formatMoney(match.amount, match.currency, locale)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onAttach(match.id)}
            >
              {t('match.attach')}
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-sm text-expense">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        disabled={busy}
        onClick={onCreateNew}
        className="w-full"
      >
        {busy ? tn('saving') : t('match.createNew')}
      </Button>
    </div>
  );
}
