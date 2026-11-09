import { useTranslations } from 'use-intl';
import { CreditCard, Wallet } from 'lucide-react-native';

import type { HistoryAccountCard } from '@finnit/core/history/request';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Card } from '@finnit/ui-native/components/ui/card';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Progress } from '@finnit/ui-native/components/ui/progress';
import { Text } from '@finnit/ui-native/components/ui/text';

import { CardPeriodSummary } from '@/components/accounts/card-period-summary';
import { TextLink } from '@/components/finance/text-link';

/**
 * Movimientos filtered by one account (the web's AccountBalanceCard): its
 * balance now; a credit card, what is owed, its limit and the cycle whose
 * payment is due.
 */
export function AccountBalanceCard({ card }: { card: HistoryAccountCard }) {
  const t = useTranslations('history.accountCard');
  const title = card.credit
    ? card.inFavor
      ? t('inFavor')
      : t('debt')
    : t('balance');
  return (
    <Card className="gap-3 rounded-card p-4">
      <TwView className="flex-row items-center justify-between gap-2">
        <TwView className="flex-1 flex-row items-center gap-2">
          <Icon
            icon={card.credit ? CreditCard : Wallet}
            size={16}
            color="--brand-ink"
          />
          <Text weight="bold" numberOfLines={1} className="flex-1 text-sm">
            {card.label}
          </Text>
        </TwView>
        <TextLink href={card.href} label={t('seeAccount')} />
      </TwView>
      <TwView>
        <Text className="text-[11px] uppercase tracking-widest text-on-surface-variant">
          {title}
        </Text>
        <Text
          weight="bold"
          className={cn(
            'text-2xl',
            (card.negative || (card.credit && !card.inFavor)) && 'text-expense',
            card.inFavor && 'text-income',
          )}
        >
          {card.balance}
        </Text>
      </TwView>
      {card.credit && card.usedPercent != null ? (
        <TwView className="gap-1.5">
          <Progress
            value={card.usedPercent}
            accessibilityLabel={t('used', { percent: card.usedPercent })}
          />
          <Text className="text-xs text-on-surface-variant">
            {t('available', {
              available: card.available ?? '—',
              limit: card.limit ?? '—',
            })}
          </Text>
        </TwView>
      ) : null}
      {card.period ? (
        <CardPeriodSummary period={card.period} compact />
      ) : card.needsTerms ? (
        <Text className="text-xs text-on-surface-variant">
          {t('needsTerms')}
        </Text>
      ) : null}
    </Card>
  );
}
