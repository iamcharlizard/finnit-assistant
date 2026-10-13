import { useTranslations } from 'next-intl';
import { Bell, Check, CircleAlert, Clock, SkipForward } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';

import type { PaymentStatus } from '@/lib/recurring/view';

/** Paid, skipped, overdue, missed, to pay or a reminder. */
export function PaymentStatusBadge({
  status,
  overdue,
}: {
  status: PaymentStatus;
  overdue: boolean;
}) {
  const t = useTranslations('recurring.status');
  switch (status) {
    case 'paid':
      return (
        <Badge variant="income">
          <Check aria-hidden /> {t('paid')}
        </Badge>
      );
    case 'skipped':
      return (
        <Badge variant="muted">
          <SkipForward aria-hidden /> {t('skipped')}
        </Badge>
      );
    case 'missed':
      return (
        <Badge variant="expense">
          <CircleAlert aria-hidden /> {overdue ? t('overdue') : t('missed')}
        </Badge>
      );
    case 'reminder':
      return (
        <Badge variant="highlight">
          <Bell aria-hidden /> {t('reminder')}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <Clock aria-hidden /> {t('upcoming')}
        </Badge>
      );
  }
}
