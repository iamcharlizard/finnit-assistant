import { useTranslations } from 'use-intl';
import { Pause, Play } from 'lucide-react-native';

import type { ExpenseItem } from '@finnit/core/recurring/view';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Badge } from '@finnit/ui-native/components/ui/badge';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Progress } from '@finnit/ui-native/components/ui/progress';
import { Text } from '@finnit/ui-native/components/ui/text';

import { KindIcon } from './kind-icon';

/** A recurring expense: what, how often, how much a month and when next. */
export function ExpenseCard({
  item,
  busy,
  onToggleActive,
}: {
  item: ExpenseItem;
  busy: boolean;
  onToggleActive: () => void;
}) {
  const t = useTranslations();
  return (
    <TwView className={cn('gap-3 rounded-2xl border border-outline bg-surface p-4')}>
      <TwView className="flex-row items-start gap-3">
        <TwView className={cn(!item.active && 'opacity-60')}>
          <KindIcon kind={item.kind} />
        </TwView>
        <TwView className="min-w-0 flex-1 gap-0.5">
          <Text accessibilityRole="header" weight="bold" numberOfLines={1} className="text-base">
            {item.name}
          </Text>
          <Text className="text-xs text-on-surface-variant">
            {t(`finance.recurringKinds.${item.kind}`)} · {item.frequencyLabel}
          </Text>
        </TwView>
        <Button
          variant="ghost"
          size="icon-sm"
          icon={item.active ? Pause : Play}
          disabled={busy}
          onPress={onToggleActive}
          label={item.active ? t('recurring.actions.pause') : t('recurring.actions.resume')}
        />
      </TwView>
      <TwView className="flex-row flex-wrap items-end justify-between gap-2">
        <TwView>
          <Text weight="bold" className="text-xl" style={{ fontVariant: ['tabular-nums'] }}>
            {item.amountLabel}
          </Text>
          <Text className="text-xs text-on-surface-variant">{item.monthlyLabel}</Text>
        </TwView>
        <TwView className="flex-row flex-wrap justify-end gap-1">
          {!item.active ? <Badge variant="muted" label={t('recurring.list.paused')} /> : null}
          <Badge variant="outline" label={t(`recurring.trackingModes.${item.trackingMode}.label`)} />
        </TwView>
      </TwView>
      {item.installments ? (
        <TwView className="gap-1">
          <Text className="text-xs text-on-surface-variant">
            {t('recurring.list.installments', { paid: item.installments.paid, total: item.installments.total })}
          </Text>
          <Progress value={item.installments.percent} />
        </TwView>
      ) : null}
      {item.nextDueLabel || item.accountLabel || item.categoryLabel ? (
        <TwView className="gap-0.5 border-t border-outline pt-2">
          {[item.nextDueLabel, item.accountLabel, item.categoryLabel].filter(Boolean).map((line) => (
            <Text key={line} className="text-xs text-on-surface-variant">
              {line}
            </Text>
          ))}
        </TwView>
      ) : null}
    </TwView>
  );
}
