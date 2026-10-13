'use client';

import { useTranslations } from 'next-intl';
import { Copy, PiggyBank, Plus } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

/** A month without a budget: create one, or copy an earlier month's. */
export function NoBudget({
  monthLabel,
  templateLabel,
  busy,
  onCreate,
  onCopy,
}: {
  monthLabel: string;
  /** The month a budget can be copied from, or null. */
  templateLabel: string | null;
  busy: boolean;
  onCreate: () => void;
  onCopy: () => void;
}) {
  const t = useTranslations('budgets.empty');
  return (
    <section className="flex flex-col items-center gap-3 rounded-card border border-dashed border-on-background/12 px-6 py-10 text-center">
      <PiggyBank aria-hidden className="size-10 text-on-surface-variant/50" />
      <h2 className="text-base font-medium text-on-background">
        {t('title', { month: monthLabel })}
      </h2>
      <p className="max-w-md text-sm text-on-surface-variant">
        {t('description')}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCreate}
          disabled={busy}
        >
          <Plus aria-hidden /> {t('create')}
        </Button>
        {templateLabel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCopy}
            disabled={busy}
          >
            <Copy aria-hidden /> {t('copy', { month: templateLabel })}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
