import { useTranslations } from 'next-intl';
import { CalendarClock } from 'lucide-react';

import { Card } from '@finnit/ui/components/ui/card';

import type { StatementFact } from '@/lib/statements/view';

/** What the statement says: balances, payments and dates. */
export function StatementFactsCard({ facts }: { facts: StatementFact[] }) {
  const t = useTranslations('statements');
  if (facts.length === 0) return null;
  return (
    <Card className="gap-3 rounded-[20px] p-5">
      <h2 className="flex items-center gap-2 text-[11px] font-medium tracking-[0.15em] text-on-surface-variant uppercase">
        <CalendarClock aria-hidden className="size-4 text-brand-ink" />
        {t('factsTitle')}
      </h2>
      <dl className="flex flex-col divide-y divide-glass-border text-sm">
        {facts.map((fact) => (
          <div key={fact.key} className="flex justify-between gap-3 py-2">
            <dt className="text-on-surface-variant">{fact.label}</dt>
            <dd className="text-right font-medium text-on-background tabular-nums">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
