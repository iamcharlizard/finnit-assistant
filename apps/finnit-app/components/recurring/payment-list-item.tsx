import { useTranslations } from 'use-intl';
import { Check, RotateCcw, SkipForward } from 'lucide-react-native';

import type { PaymentAction } from '@finnit/core/recurring/types';
import type { PaymentItem, PaymentStatus } from '@finnit/core/recurring/view';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Badge } from '@finnit/ui-native/components/ui/badge';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Text } from '@finnit/ui-native/components/ui/text';

import { KindIcon } from './kind-icon';

const ACTION_ICONS = { pay: Check, skip: SkipForward, reopen: RotateCcw };

function StatusBadge({ status, overdue }: { status: PaymentStatus; overdue: boolean }) {
  const t = useTranslations('recurring.status');
  switch (status) {
    case 'paid':
      return <Badge variant="income" label={t('paid')} />;
    case 'skipped':
      return <Badge variant="muted" label={t('skipped')} />;
    case 'missed':
      return <Badge variant="expense" label={overdue ? t('overdue') : t('missed')} />;
    case 'reminder':
      return <Badge variant="highlight" label={t('reminder')} />;
    default:
      return <Badge variant="outline" label={t('upcoming')} />;
  }
}

/** A due payment with its status and what can be done with it. */
export function PaymentListItem({
  item,
  busy,
  onAction,
}: {
  item: PaymentItem;
  busy: boolean;
  onAction: (action: PaymentAction) => void;
}) {
  const t = useTranslations('recurring');
  const details = [item.accountLabel, item.dateLabel].filter(Boolean).join(' · ');
  return (
    <TwView className={cn('gap-3 rounded-2xl border border-outline bg-surface p-3', item.status === 'skipped' && 'opacity-75')}>
      <TwView className="flex-row items-start gap-3">
        <KindIcon kind={item.kind} />
        <TwView className="min-w-0 flex-1 gap-1">
          <TwView className="flex-row items-start justify-between gap-2">
            <Text weight="medium" numberOfLines={1} className={cn('min-w-0 flex-1 text-sm', item.status === 'skipped' && 'line-through')}>
              {item.name}
            </Text>
            <Text weight="bold" className="text-sm" style={{ fontVariant: ['tabular-nums'] }}>
              {item.amountLabel}
            </Text>
          </TwView>
          <Text className="text-xs text-on-surface-variant">{details}</Text>
          <StatusBadge status={item.status} overdue={item.overdue} />
        </TwView>
      </TwView>
      {item.actions.length > 0 ? (
        <TwView className="flex-row flex-wrap items-center justify-end gap-2">
          {item.actions.map((action) => (
            <Button
              key={action}
              size="sm"
              variant={action === 'pay' ? 'secondary' : 'outline'}
              icon={ACTION_ICONS[action]}
              disabled={busy}
              onPress={() => onAction(action)}
              label={t(`actions.${action}`)}
              accessibilityLabel={t(`actions.${action}Label`, { name: item.name })}
            />
          ))}
        </TwView>
      ) : null}
    </TwView>
  );
}
