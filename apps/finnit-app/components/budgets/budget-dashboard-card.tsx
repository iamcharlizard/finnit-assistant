import { useTranslations } from 'use-intl';
import { PiggyBank } from 'lucide-react-native';

import type { BudgetCardView } from '@finnit/core/budgets/view';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

import { TextLink } from '@/components/finance/text-link';
import { StatusText } from './status-text';
import { UsageBar } from './usage-bar';

/** The dashboard's compact budget card: the month's spending against it. */
export function BudgetDashboardCard({ card }: { card: BudgetCardView }) {
  const t = useTranslations('budgets.card');
  return (
    <TwView className="gap-3 rounded-card border border-outline bg-surface p-5">
      <TwView className="flex-row items-center justify-between gap-2">
        <TwView className="min-w-0 flex-1 flex-row items-center gap-2">
          <Icon icon={PiggyBank} size={20} color="--on-surface-variant" />
          <Text accessibilityRole="header" weight="bold" numberOfLines={1} className="flex-1 text-base">
            {t('title', { month: card.monthLabel })}
          </Text>
        </TwView>
        <TextLink href="/planning/budgets" label={t('link')} />
      </TwView>
      <TwView className="flex-row flex-wrap items-baseline gap-x-2">
        <Text weight="bold" className="text-2xl text-on-background" style={{ fontVariant: ['tabular-nums'] }}>
          {card.spent}
        </Text>
        <Text className="text-sm text-on-surface-variant">{t('of', { amount: card.budgeted })}</Text>
      </TwView>
      <UsageBar percent={card.percent} status={card.status} label={t('barLabel', { percent: card.percent })} />
      <StatusText status={card.status}>
        {card.over ? t('over', { amount: card.remaining }) : t('left', { amount: card.remaining, percent: card.percent })}
      </StatusText>
    </TwView>
  );
}
