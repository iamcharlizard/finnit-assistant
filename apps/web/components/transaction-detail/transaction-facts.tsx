'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Link2 } from 'lucide-react';

import { Card } from '@finnit/ui/components/ui/card';

import type { TransactionDetailView } from '@finnit/core/transaction-detail/view';

interface Fact {
  label: string;
  value: string;
  href?: string;
  /** Opens another movement's detail. */
  transactionId?: string;
}

/**
 * Account, category, source, status, the transfer's other side (opens its
 * detail here), the recurring payment and the notes.
 */
export function TransactionFacts({
  view,
  merchant,
  description,
  onOpenTransaction,
}: {
  view: TransactionDetailView;
  merchant: string;
  description: string;
  onOpenTransaction: (id: string) => void;
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
      value: view.pending
        ? tf('pending')
        : view.inProcess
          ? tf('inProcess')
          : tf('completed'),
    },
    ...(view.counterpart
      ? [
          {
            label: t('fields.transfer'),
            value: view.counterpart.label,
            transactionId: view.counterpart.transactionId,
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
    ...(view.notes ? [{ label: t('fields.notes'), value: view.notes }] : []),
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
            <dd className="min-w-0 font-medium break-words whitespace-pre-line text-on-background sm:text-right">
              {fact.transactionId ? (
                <button
                  type="button"
                  onClick={() => onOpenTransaction(fact.transactionId!)}
                  className="inline-flex items-center gap-1 text-left text-brand-ink underline-offset-4 hover:underline"
                >
                  <Link2 aria-hidden className="size-3.5 shrink-0" />
                  {fact.value}
                </button>
              ) : fact.href ? (
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
