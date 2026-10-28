'use client';

import type * as React from 'react';
import { useTranslations } from 'next-intl';
import { Eye } from 'lucide-react';

import type { AliasPreviewState } from '@/hooks/use-alias-preview';
import { dayKeyOf, shortDate } from '@/lib/finance/dates';
import { formatMoney } from '@/lib/finance/money';
import { useLocalizer } from '@/lib/i18n/client';

/** "Coincide con N movimientos" and up to 20 samples of the original text. */
export function AliasPreview({ state }: { state: AliasPreviewState }) {
  const t = useTranslations('aliases.preview');
  const { locale } = useLocalizer();

  let body: React.ReactNode;
  if (state.status === 'idle') {
    body = <p className="text-on-surface-variant">{t('idle')}</p>;
  } else if (state.status === 'loading') {
    body = <p className="text-on-surface-variant">{t('loading')}</p>;
  } else if (state.status === 'error') {
    body = <p className="text-expense">{state.regexError ?? t('failed')}</p>;
  } else {
    const { count, samples } = state.preview;
    body = (
      <>
        <p className="font-medium text-on-background">
          {t('count', { count })}
        </p>
        {samples.length > 0 ? (
          <ul className="mt-2 flex max-h-56 flex-col divide-y divide-outline overflow-y-auto">
            {samples.map((s) => (
              <li
                key={s.transactionId}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs text-on-background">
                    {s.original}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    {shortDate(dayKeyOf(s.date), locale)}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium text-on-background">
                  {formatMoney(s.amount, s.currency, locale)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {count > samples.length && samples.length > 0 ? (
          <p className="mt-1 text-[11px] text-on-surface-variant">
            {t('more', { shown: samples.length, count })}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <section
      aria-live="polite"
      aria-label={t('title')}
      className="rounded-input bg-track p-3 text-sm"
    >
      <h3 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
        <Eye aria-hidden className="size-3.5" /> {t('title')}
      </h3>
      {body}
    </section>
  );
}
