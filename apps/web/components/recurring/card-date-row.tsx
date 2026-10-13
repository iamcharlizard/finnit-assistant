import { CalendarClock, CreditCard } from 'lucide-react';

import type { CardDateItem } from '@/lib/recurring/view';

/** A credit card's cut-off or payment-due date in the payments list. */
export function CardDateRow({
  item,
  dateLabel,
}: {
  item: CardDateItem;
  /** Shown when the list covers more than one day. */
  dateLabel?: string;
}) {
  const Icon = item.kind === 'statement' ? CreditCard : CalendarClock;
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-2xl border border-[#6c72cb]/30 bg-[#6c72cb]/5 p-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-chip bg-[#6c72cb]">
        <Icon aria-hidden className="size-5 text-white" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-on-background">
          {item.label}
        </span>
        {dateLabel ? (
          <span className="text-xs text-on-surface-variant">{dateLabel}</span>
        ) : null}
      </span>
    </div>
  );
}
