'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { Card } from '@finnit/ui/components/ui/card';

import type { TransactionDetailView } from '@/lib/transaction-detail/view';

interface Fact {
  label: string;
  value: string;
  href?: string;
}

/** Account, category, source, status, links to the transfer's other side and the recurring payment. */
export function TransactionFacts({
  view,
  merchant,
  description,
}: {
  view: TransactionDetailView;
  merchant: string;
  description: string;
}) {
  const t = useTranslations('transaction');
  const tf = useTranslations('finance');
  const facts: Fact[] = [
    { label: t('fields.account'), value: view.accountLabel },
    ...(view.categoryLabel
      ? [{ label: t('fields.category'), value: view.categoryLabel }]
      : []),
    { label: t('fields.source'), value: t(`sources.${view.sourceKind}`) },
    {
      label: t('fields.status'),
      value: view.pending ? tf('pending') : tf('completed'),
    },
    ...(view.counterpart
      ? [
          {
            label: t('fields.transfer'),
            value: view.counterpart.label,
            href: view.counterpart.href,
          },
        ]
      : []),
    ...(view.recurring
      ? [
          {
            label: t('fields.recurring'),
            value: view.recurring.label,
            href: view.recurring.href,
          },
        ]
      : []),
    // A private movement's texts stay behind "Ver original".
    ...(!view.isPrivate && merchant
      ? [{ label: t('fields.merchant'), value: merchant }]
      : []),
    // Transfers carry the API's own "Transfer to …" text: not worth a row.
    ...(!view.isPrivate &&
    description &&
    description !== merchant &&
    !/^Transfer to .+/i.test(description)
      ? [{ label: t('fields.description'), value: description }]
      : []),
    ...(!view.isPrivate && view.original && view.original !== merchant
      ? [{ label: t('fields.original'), value: view.original }]
      : []),
  ];

  return (
    <Card className="gap-3 rounded-[20px] p-5">
      <h2 className="text-[11px] font-medium tracking-[0.15em] text-on-surface-variant uppercase">
        {t('detailsTitle')}
      </h2>
      <dl className="flex flex-col divide-y divide-glass-border text-sm">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:justify-between sm:gap-4"
          >
            <dt className="shrink-0 text-on-surface-variant">{fact.label}</dt>
            <dd className="min-w-0 font-medium break-words text-on-background sm:text-right">
              {fact.href ? (
                <Link
                  href={fact.href}
                  className="text-brand-ink underline-offset-4 hover:underline"
                >
                  {fact.value}
                </Link>
              ) : (
                fact.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
