'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@finnit/ui/components/ui/button';

import { dayKeyOf, shortDate } from '@/lib/finance/dates';
import { formatMoney } from '@/lib/finance/money';
import type { SimilarTransaction } from '@/lib/new-entry/graphql';

/** "¿Ya está registrado?": look-alikes of the movement about to be created. */
export function DuplicateReview({
  matches,
  hasAttachment,
  busy,
  error,
  onIsThis,
  onCreateAnyway,
}: {
  matches: SimilarTransaction[];
  hasAttachment: boolean;
  busy: boolean;
  error: string | null;
  onIsThis: (transactionId: string) => void;
  onCreateAnyway: () => void;
}) {
  const t = useTranslations('newEntry');
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-on-surface-variant">
        {t('duplicates.description', { count: matches.length })}
        {hasAttachment ? ` ${t('duplicates.attachHint')}` : null}
      </p>
      <ul className="flex flex-col gap-2">
        {matches.map((match) => (
          <li
            key={match.id}
            className="flex items-center gap-3 rounded-xl border border-outline bg-surface p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-on-background">
                {match.displayName ||
                  match.merchantName ||
                  match.description ||
                  t('duplicates.noDescription')}
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
              onClick={() => onIsThis(match.id)}
            >
              {t('duplicates.isThis')}
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
        onClick={onCreateAnyway}
        className="w-full"
      >
        {busy ? t('saving') : t('duplicates.createAnyway')}
      </Button>
    </div>
  );
}
