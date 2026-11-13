import * as React from 'react';
import { useTranslations } from 'use-intl';
import { Eye, EyeOff, Lock, LockKeyhole } from 'lucide-react-native';

import type { TransactionDetailView } from '@finnit/core/transaction-detail/view';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Badge } from '@finnit/ui-native/components/ui/badge';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Card } from '@finnit/ui-native/components/ui/card';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

const AMOUNT_COLOR = { income: 'text-income', expense: 'text-expense', neutral: 'text-on-background' } as const;

/**
 * The movement's name (with a lock when private), amount and type. A
 * private movement hides its original text until "Ver original".
 */
export function TransactionSummary({
  view,
  onUnlock,
}: {
  view: TransactionDetailView;
  /** The original is behind the privacy PIN: ask for it. */
  onUnlock: () => void;
}) {
  const t = useTranslations();
  const [revealed, setRevealed] = React.useState(false);
  return (
    <Card className="gap-3 rounded-[20px] p-5">
      <TwView className="flex-row flex-wrap items-center gap-2">
        <Badge variant="muted" label={view.typeLabel} />
        {view.cancelled ? (
          <Badge variant="muted" label={t('finance.cancelled')} />
        ) : view.pending ? (
          <Badge variant="highlight" label={t('finance.pending')} />
        ) : view.inProcess ? (
          <Badge variant="highlight" label={t('finance.inProcess')} />
        ) : null}
        {view.isPrivate ? <Badge variant="outline" label={t('transaction.private')} /> : null}
      </TwView>
      <TwView className="flex-row items-center gap-2">
        {view.isPrivate ? <Icon icon={Lock} size={20} color="--on-surface-variant" /> : null}
        <Text accessibilityRole="header" weight="bold" className="min-w-0 flex-1 text-2xl">
          {view.title}
        </Text>
      </TwView>
      <Text
        weight="bold"
        className={cn('text-[32px]', AMOUNT_COLOR[view.variant])}
        style={{ fontVariant: ['tabular-nums'], lineHeight: 40 }}
      >
        {view.amount}
      </Text>
      <Text className="text-sm text-on-surface-variant">{view.dateLabel}</Text>
      {view.isPrivate ? (
        <TwView className="gap-2 border-t border-glass-border pt-3">
          <Text className="text-xs text-on-surface-variant">{t('transaction.privateHint')}</Text>
          {view.originalLocked ? (
            <>
              <Button
                variant="outline"
                size="sm"
                icon={LockKeyhole}
                label={t('transaction.showOriginal')}
                className="self-start"
                onPress={onUnlock}
              />
              <Text className="text-xs text-on-surface-variant">{t('transaction.originalLocked')}</Text>
            </>
          ) : view.original ? (
            <>
              <Button
                variant="outline"
                size="sm"
                icon={revealed ? EyeOff : Eye}
                label={revealed ? t('transaction.hideOriginal') : t('transaction.showOriginal')}
                className="self-start"
                onPress={() => setRevealed((r) => !r)}
              />
              {revealed ? (
                <Text className="rounded-input bg-track p-3 text-sm">{view.original}</Text>
              ) : null}
            </>
          ) : null}
        </TwView>
      ) : null}
    </Card>
  );
}
