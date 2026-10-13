import { useTranslations } from 'next-intl';
import { CircleCheck, TriangleAlert } from 'lucide-react';

import { Card } from '@finnit/ui/components/ui/card';
import { cn } from '@finnit/ui/lib/utils';

import type { StatementDetailView } from '@/lib/statements/view';

/**
 * Previous balance + extracted lines vs the statement's balance. A
 * difference means lines are missing or misread: warn before confirming.
 */
export function StatementCheckCard({
  check,
}: {
  check: StatementDetailView['check'];
}) {
  const t = useTranslations('statements.check');
  if (!check.computed && !check.statement) return null;
  const rows = [
    { label: t('computed'), value: check.computed },
    { label: t('statement'), value: check.statement },
    { label: t('difference'), value: check.difference },
  ].filter((r): r is { label: string; value: string } => r.value !== null);

  return (
    <Card
      className={cn(
        'gap-3 rounded-[20px] p-5',
        check.mismatch && 'border-expense/40',
      )}
    >
      <h2 className="text-[11px] font-medium tracking-[0.15em] text-on-surface-variant uppercase">
        {t('title')}
      </h2>
      <dl className="flex flex-col gap-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3">
            <dt className="text-on-surface-variant">{row.label}</dt>
            <dd
              className={cn(
                'text-right font-medium tabular-nums text-on-background',
                row.label === t('difference') &&
                  check.mismatch &&
                  'font-bold text-expense',
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {check.mismatch ? (
        <p
          role="alert"
          className="flex gap-2 rounded-input bg-expense/10 p-3 text-xs text-expense"
        >
          <TriangleAlert aria-hidden className="size-4 shrink-0" />
          {t('mismatch')}
        </p>
      ) : check.difference !== null ? (
        <p className="flex items-center gap-2 text-xs text-income">
          <CircleCheck aria-hidden className="size-4 shrink-0" />
          {t('ok')}
        </p>
      ) : null}
    </Card>
  );
}
