'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';

/**
 * Spending that no cap counts: without a category (with a link to sort it
 * out) and in categories without a cap.
 */
export function OutsideCapsNote({
  uncategorized,
  uncapped,
}: {
  uncategorized: string | null;
  uncapped: string | null;
}) {
  const t = useTranslations('budgets.outside');
  if (!uncategorized && !uncapped) return null;
  return (
    <aside className="flex items-start gap-3 rounded-input bg-track/60 p-4 text-sm text-on-background">
      <Info
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-on-surface-variant"
      />
      <div className="flex flex-col gap-1">
        <p className="font-medium">{t('title')}</p>
        {uncategorized ? (
          <p className="text-on-surface-variant">
            {t('uncategorized', { amount: uncategorized })}{' '}
            <Link
              href="/transactions/categorize"
              className="font-medium text-income hover:underline"
            >
              {t('categorize')}
            </Link>
          </p>
        ) : null}
        {uncapped ? (
          <p className="text-on-surface-variant">
            {t('uncapped', { amount: uncapped })}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
