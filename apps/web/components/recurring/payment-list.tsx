'use client';

import { useTranslations } from 'next-intl';
import { CalendarCheck } from 'lucide-react';

import { SectionHeading } from '@finnit/ui/components/ui/section-heading';

import { EmptyState } from '@/components/finance/empty-state';
import type { PaymentAction } from '@/lib/recurring/api';
import type { CardDateItem, PaymentItem } from '@/lib/recurring/view';
import { CardDateRow } from './card-date-row';
import { PaymentListItem } from './payment-list-item';

/** Side panel: the payments of the selected day, or of the whole period. */
export function PaymentList({
  title,
  payments,
  cardDates,
  emptyText,
  busyKey,
  cardDateLabel,
  onAction,
  onEdit,
  onShowPeriod,
}: {
  title: string;
  payments: PaymentItem[];
  cardDates: CardDateItem[];
  emptyText: string;
  /** The payment whose action is running. */
  busyKey: string | null;
  /** Date of a card date when the list covers several days. */
  cardDateLabel?: (item: CardDateItem) => string;
  onAction: (item: PaymentItem, action: PaymentAction) => void;
  onEdit: (item: PaymentItem) => void;
  /** Shown when a day is selected, to go back to the period's list. */
  onShowPeriod?: () => void;
}) {
  const t = useTranslations('recurring.panel');
  return (
    <section aria-label={title} className="flex min-w-0 flex-col">
      <SectionHeading
        title={title}
        action={
          onShowPeriod ? (
            <button
              type="button"
              onClick={onShowPeriod}
              className="flex min-h-11 items-center text-sm font-medium text-income hover:underline"
            >
              {t('showPeriod')}
            </button>
          ) : null
        }
      />
      {payments.length === 0 && cardDates.length === 0 ? (
        <EmptyState icon={CalendarCheck} title={emptyText} className="py-8" />
      ) : (
        <div className="flex flex-col gap-2">
          {cardDates.map((item) => (
            <CardDateRow
              key={item.id}
              item={item}
              dateLabel={cardDateLabel?.(item)}
            />
          ))}
          <ul className="flex flex-col gap-2">
            {payments.map((item) => (
              <PaymentListItem
                key={item.key}
                item={item}
                busy={busyKey === item.key}
                onAction={(action) => onAction(item, action)}
                onEdit={() => onEdit(item)}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
