import { useTranslations } from 'use-intl';

import { ICON_COLORS } from '@finnit/core/finance/categories';
import type { PaymentRow as PaymentRowData } from '@finnit/core/finance/payments';
import { CATEGORY_ICONS } from '@finnit/ui-native/lib/category-icons';
import { PaymentItem } from '@finnit/ui-native/components/finance/payment-item';

/** A recurring payment due on a day (dashboard, recurring). */
export function PaymentRow({ row, onPress }: { row: PaymentRowData; onPress?: () => void }) {
  const t = useTranslations('finance.paymentStatus');
  return (
    <PaymentItem
      title={row.title}
      amount={row.amount}
      status={row.status}
      statusLabel={t(row.status)}
      timeLabel={row.timeLabel}
      icon={CATEGORY_ICONS[row.iconKey]}
      iconBg={ICON_COLORS[row.iconKey]}
      onPress={onPress}
    />
  );
}
