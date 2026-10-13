import { useTranslations } from 'next-intl';
import { CalendarCheck } from 'lucide-react';

import { SectionHeading } from '@finnit/ui/components/ui/section-heading';

import { CardDateItem } from '@/components/calendar/card-date-item';
import { EmptyState } from '@/components/finance/empty-state';
import { PaymentRow } from '@/components/finance/payment-row';
import type { CardDate } from '@/lib/calendar/view';
import type { PaymentRow as PaymentRowData } from '@/lib/finance/payments';

/** Payments (and card dates) of the selected day, or of the whole month. */
export function DayAgenda({
  title,
  payments,
  cardDates,
  emptyText,
  onShowMonth,
}: {
  title: string;
  payments: PaymentRowData[];
  cardDates: CardDate[];
  emptyText: string;
  /** Shown when a day is selected, to go back to the month's list. */
  onShowMonth?: () => void;
}) {
  const t = useTranslations('calendar');
  return (
    <section>
      <SectionHeading
        title={title}
        action={
          onShowMonth ? (
            <button
              type="button"
              onClick={onShowMonth}
              className="flex min-h-11 items-center text-sm font-medium text-income hover:underline"
            >
              {t('showMonth')}
            </button>
          ) : null
        }
      />
      {payments.length === 0 && cardDates.length === 0 ? (
        <EmptyState icon={CalendarCheck} title={emptyText} className="py-8" />
      ) : (
        <div className="flex flex-col gap-2">
          {cardDates.map((item) => (
            <CardDateItem key={item.id} item={item} />
          ))}
          {payments.map((row) => (
            <PaymentRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}
