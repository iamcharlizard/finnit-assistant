'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CopyCheck, Merge, X } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { toast } from '@finnit/ui/components/ui/toaster';

import { MergeDuplicateDialog } from '@/components/duplicates/merge-duplicate-dialog';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import {
  DUPLICATE_SUGGESTIONS_QUERY,
  resolveDuplicate,
  type ApiDuplicateSuggestion,
  type DuplicateSuggestionsResult,
} from '@finnit/core/duplicates/request';
import { toMergeSide } from '@finnit/core/duplicates/view';
import { transactionErrorMessage } from '@finnit/core/transaction-detail/api';

const FIRST = 10;

/**
 * "Posibles duplicados" in "Clasificar movimientos": pairs of movements of
 * one account that look like the same money recorded twice (one by hand,
 * one from the bank), with "Fusionar" and "No es duplicado".
 */
export function DuplicateSuggestionsPanel() {
  const t = useTranslations('duplicates');
  const l = useLocalizer();
  const router = useRouter();
  const [data, setData] = React.useState<
    DuplicateSuggestionsResult['duplicateSuggestions'] | null
  >(null);
  const [merging, setMerging] = React.useState<ApiDuplicateSuggestion | null>(
    null,
  );
  const [busy, setBusy] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    let live = true;
    gql<DuplicateSuggestionsResult>(DUPLICATE_SUGGESTIONS_QUERY, {
      first: FIRST,
    })
      .then((result) => live && setData(result.duplicateSuggestions))
      .catch(() => live && setData(null));
    return () => {
      live = false;
    };
  }, [version]);

  const reload = () => {
    setVersion((v) => v + 1);
    router.refresh();
  };

  function dismiss(id: string) {
    setBusy(id);
    resolveDuplicate({ id, action: 'dismiss' }, gql)
      .then(() => {
        toast(t('toasts.dismissed'));
        reload();
      })
      .catch((e: unknown) => toast.error(transactionErrorMessage(e, l.t)))
      .finally(() => setBusy(null));
  }

  const rows = data?.edges.map((e) => e.node) ?? [];
  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby="duplicate-suggestions-title"
      className="mb-6 flex flex-col gap-3 rounded-3xl border border-glass-border bg-surface p-4"
    >
      <div className="flex flex-col gap-1 px-1">
        <h2
          id="duplicate-suggestions-title"
          className="flex items-center gap-2 text-base font-bold text-on-background"
        >
          <CopyCheck aria-hidden className="size-4" />
          {t('title')}
          <span className="text-sm font-medium text-on-surface-variant">
            · {data?.totalCount}
          </span>
        </h2>
        <p className="text-sm text-on-surface-variant">{t('description')}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((s) => {
          const keep = toMergeSide(s.keep, l);
          const drop = toMergeSide(s.drop, l);
          return (
            <li
              key={s.id}
              className="flex flex-col gap-3 rounded-2xl bg-track/60 p-3"
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {[drop, keep].map((side) => (
                  <div key={side.id} className="min-w-0">
                    <p className="truncate text-sm font-medium text-on-background">
                      {side.title}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {[side.amount, side.date, side.origin, side.account]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy === s.id}
                  onClick={() => setMerging(s)}
                >
                  <Merge aria-hidden /> {t('merge')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === s.id}
                  onClick={() => dismiss(s.id)}
                >
                  <X aria-hidden /> {t('notDuplicate')}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {merging ? (
        <MergeDuplicateDialog
          transaction={merging.drop}
          other={merging.keep}
          onClose={() => setMerging(null)}
          onMerged={() => {
            setMerging(null);
            toast.success(t('toasts.merged'));
            reload();
          }}
        />
      ) : null}
    </section>
  );
}
