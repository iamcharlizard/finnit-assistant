import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CalendarClock, FileUp } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Card } from '@finnit/ui/components/ui/card';

import type { AccountDetail } from '@/lib/accounts/view';

/** Cut-off and payment dates, statement amounts and recurring charges. */
export function AccountFacts({ detail }: { detail: AccountDetail }) {
  const t = useTranslations('cards');
  const ts = useTranslations('statements');
  const isCredit = detail.account.type === 'credit';
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
      <Button variant="outline" size="sm" className="self-start" asChild>
        <Link
          href={`/statements?account=${encodeURIComponent(detail.account.id)}`}
        >
          <FileUp aria-hidden /> {ts('uploadFromAccount')}
        </Link>
      </Button>
    </Card>
  );
}
