import { useTranslations } from 'next-intl';
import { CalendarClock } from 'lucide-react';

import { Card } from '@finnit/ui/components/ui/card';

import type { CardDetail } from '@/lib/cards/view';

/** Cut-off and payment dates, statement amounts and recurring charges. */
export function CardFacts({ detail }: { detail: CardDetail }) {
  const t = useTranslations('cards');
  const isCredit = detail.card.kind === 'credit';
  if (!isCredit) return null;

  return (
    <Card className="gap-3 rounded-[20px] p-4.5">
      <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-on-surface-variant">
        <CalendarClock aria-hidden className="size-4.5 text-brand-ink" />
        {t('factsTitle')}
      </h3>
      {detail.facts.length > 0 ? (
        <dl className="flex flex-col gap-2 text-sm">
          {detail.facts.map((fact) => (
            <div key={fact.label} className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">{fact.label}</dt>
              <dd className="text-right font-medium text-on-background">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-on-surface-variant">{t('noFacts')}</p>
      )}
      {detail.recurring ? (
        <p className="border-t border-glass-border pt-3 text-xs text-on-surface-variant">
          {t('recurringSummary', {
            count: detail.recurring.count,
            expected: detail.recurring.expected,
            paid: detail.recurring.paid,
          })}
        </p>
      ) : null}
    </Card>
  );
}
