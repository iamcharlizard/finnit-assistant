'use client';

import { PaymentItem } from '@finnit/ui/components/finance/payment-item';

import { ICON_COLORS } from '@/lib/finance/categories';
import { CATEGORY_ICONS } from '@/lib/finance/category-icons';
import type { PaymentRow as PaymentRowData } from '@/lib/finance/payments';

/** A recurring payment due on a day (dashboard, calendar). */
export function PaymentRow({ row }: { row: PaymentRowData }) {
  return (
    <PaymentItem
      title={row.title}
      amount={row.amount}
      status={row.status}
      timeLabel={row.timeLabel}
      icon={CATEGORY_ICONS[row.iconKey]}
      iconBg={ICON_COLORS[row.iconKey]}
    />
  );
}
