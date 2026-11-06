import { useTranslations } from 'next-intl';
import { FileText } from 'lucide-react';

import { Card } from '@finnit/ui/components/ui/card';

import type { AccountDetail } from '@finnit/core/accounts/view';

/** The month's statement amounts and the interest rate; nothing without them. */
export function AccountFacts({ facts }: { facts: AccountDetail['facts'] }) {
  const t = useTranslations('accounts.detail');
  if (facts.length === 0) return null;

  return (
    <Card className="gap-2.5 rounded-[20px] p-4.5">
      <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-on-surface-variant">
        <FileText aria-hidden className="size-4 text-brand-ink" />
        {t('statement')}
      </h3>
      <dl className="flex flex-col gap-1.5 text-sm">
        {facts.map((fact) => (
          <div key={fact.label} className="flex justify-between gap-3">
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
