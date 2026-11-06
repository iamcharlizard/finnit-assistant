'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeftRight, UserRound, X } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { toast } from '@finnit/ui/components/ui/toaster';
import { cn } from '@finnit/ui/lib/utils';

import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import type { EntryCategory } from '@/lib/new-entry/graphql';
import {
  RESOLVE_TRANSFER_SUGGESTION_MUTATION,
  type TransferSuggestionView,
} from '@/lib/transfers/suggestions';
import { ConvertTransferDialog } from './convert-transfer-dialog';
import { PaidSomeoneDialog } from './paid-someone-dialog';

/**
 * "Posibles transferencias" at the top of "Clasificar movimientos": each
 * bank movement that looks like money moved between the user's accounts,
 * with "A mi cuenta", "A otra persona" and "Ignorar".
 */
export function TransferSuggestionsPanel({
  suggestions,
  total,
  categories,
}: {
  suggestions: TransferSuggestionView[];
  total: number;
  categories: EntryCategory[];
}) {
  const t = useTranslations('transfers.suggestions');
  const { t: translate } = useLocalizer();
  const router = useRouter();
  const [toAccount, setToAccount] =
    React.useState<TransferSuggestionView | null>(null);
  const [toSomeone, setToSomeone] =
    React.useState<TransferSuggestionView | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  if (suggestions.length === 0) return null;

  function dismiss(id: string) {
    setBusy(id);
    gql(RESOLVE_TRANSFER_SUGGESTION_MUTATION, {
      id,
      input: { action: 'dismiss' },
    })
      .then(() => {
        toast(t('dismissed'));
        router.refresh();
      })
      .catch((e: unknown) => toast.error(requestErrorMessage(e, translate)))
      .finally(() => setBusy(null));
  }

  return (
    <section
      aria-labelledby="transfer-suggestions-title"
      className="mb-6 flex flex-col gap-3 rounded-3xl border border-glass-border bg-surface p-4"
    >
      <div className="flex flex-col gap-1 px-1">
        <h2
          id="transfer-suggestions-title"
          className="flex items-center gap-2 text-base font-bold text-on-background"
        >
          <ArrowLeftRight aria-hidden className="size-4" />
          {t('title')}
          <span className="text-sm font-medium text-on-surface-variant">
            · {t('count', { count: total })}
          </span>
        </h2>
        <p className="text-sm text-on-surface-variant">{t('description')}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {suggestions.map((s) => {
          const incoming = s.variant === 'income';
          return (
            <li
              key={s.id}
              className="flex flex-col gap-3 rounded-2xl bg-track/60 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-on-background">
                    {s.title}
                  </p>
                  <p className="text-xs text-on-surface-variant">{s.meta}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {s.hint}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 text-sm font-bold tabular-nums',
                    incoming ? 'text-income' : 'text-expense',
                  )}
                >
                  {s.amount}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy === s.id}
                  onClick={() => setToAccount(s)}
                >
                  <ArrowLeftRight aria-hidden />
                  {t(incoming ? 'fromAccount' : 'toAccount')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === s.id}
                  onClick={() => setToSomeone(s)}
                >
                  <UserRound aria-hidden />
                  {t(incoming ? 'fromSomeone' : 'toSomeone')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === s.id}
                  onClick={() => dismiss(s.id)}
                >
                  <X aria-hidden /> {t('dismiss')}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {total > suggestions.length ? (
        <p className="px-1 text-xs text-on-surface-variant">
          {t('more', { count: total - suggestions.length })}
        </p>
      ) : null}

      {toAccount ? (
        <ConvertTransferDialog
          source={toAccount.source}
          suggestion={{
            id: toAccount.id,
            pattern: toAccount.pattern,
            accountId: toAccount.accountId,
            counterpartTransactionId: toAccount.counterpartTransactionId,
          }}
          onClose={() => setToAccount(null)}
          onConverted={() => {
            setToAccount(null);
            toast.success(translate('transfers.convert.done'));
            router.refresh();
          }}
        />
      ) : null}
      {toSomeone ? (
        <PaidSomeoneDialog
          suggestion={toSomeone}
          categories={categories}
          onClose={() => setToSomeone(null)}
          onSaved={() => {
            setToSomeone(null);
            toast.success(translate('transfers.someone.done'));
            router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}
