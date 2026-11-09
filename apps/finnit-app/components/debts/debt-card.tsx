import { useTranslations } from 'use-intl';
import { CalendarClock, ChevronRight, CreditCard, HandCoins, Landmark, ShoppingBag, UserRound } from 'lucide-react-native';

import { isCardInstallments, type DebtCategory } from '@finnit/core/debts/types';
import type { DebtItem } from '@finnit/core/debts/view';
import { withAlpha } from '@finnit/ui-native/lib/color';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { useToken } from '@finnit/ui-native/theme/theme-root';
import { Badge } from '@finnit/ui-native/components/ui/badge';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Progress } from '@finnit/ui-native/components/ui/progress';
import { Text } from '@finnit/ui-native/components/ui/text';

type DebtType = DebtCategory;
const TYPE_ICONS = { institutional: Landmark, personal: UserRound, purchase_financing: ShoppingBag, card: CreditCard, other: HandCoins, msi: CalendarClock };
/** The loan charts' colors, by type (same order as the web). */
const TYPE_TOKENS: Record<DebtType, `--${string}`> = {
  institutional: '--chart-1',
  personal: '--chart-2',
  purchase_financing: '--chart-3',
  card: '--chart-4',
  other: '--chart-5',
  msi: '--chart-6',
};
const typeOf = (item: DebtItem): DebtType =>
  isCardInstallments(item.debt) ? 'msi' : item.debt.loanType ? (item.debt.loanType as DebtType) : item.kind === 'card' ? 'card' : 'other';

/** One debt: what's left of it, how much is paid and its facts; opens its screen. */
export function DebtCard({ item, onOpen }: { item: DebtItem; onOpen: () => void }) {
  const t = useTranslations('debts');
  const type = typeOf(item);
  const color = useToken(TYPE_TOKENS[type]);
  const Glyph = TYPE_ICONS[type];
  const facts = [
    item.rate ? t('card.rate', { rate: item.rate }) : t('card.noRate'),
    item.minPayment ? t('card.minPayment', { amount: item.minPayment }) : null,
    item.accountLabel ? t('card.account', { account: item.accountLabel }) : null,
  ].filter(Boolean);
  return (
    <TwPressable
      accessibilityRole="button"
      accessibilityLabel={item.name}
      onPress={onOpen}
      className={cn('gap-3 rounded-card border border-outline bg-surface p-4 active:bg-accent', item.paidOff && 'bg-muted-40')}
    >
      <TwView className="flex-row items-start gap-3">
        <TwView className="size-10 items-center justify-center rounded-chip" style={{ backgroundColor: withAlpha(color, 0.16) }}>
          <Glyph size={20} color={color} />
        </TwView>
        <TwView className="min-w-0 flex-1 gap-1">
          <Text weight="bold" numberOfLines={1} className="text-base">
            {item.name}
          </Text>
          {item.debt.lenderName ? <Text className="text-xs text-on-surface-variant">{item.debt.lenderName}</Text> : null}
          <TwView className="flex-row flex-wrap gap-1">
            <Badge variant="muted" label={item.debt.loanType ? t(`loanTypes.${item.debt.loanType}`) : t(`kinds.${item.kind}`)} />
            {item.paidOff ? <Badge variant="income" label={t('card.paidOff')} /> : null}
            {item.overdue ? <Badge variant="expense" label={t('card.overdue')} /> : null}
          </TwView>
        </TwView>
        <Icon icon={ChevronRight} size={16} color="--on-surface-variant" />
      </TwView>
      <TwView className="gap-1">
        <Text className="text-xs text-on-surface-variant">{t('card.remaining')}</Text>
        <TwView className="flex-row flex-wrap items-baseline gap-x-2">
          <Text weight="bold" className="text-2xl" style={{ fontVariant: ['tabular-nums'] }}>
            {item.remaining}
          </Text>
          <Text className="text-sm text-on-surface-variant">{t('card.of', { amount: item.principal })}</Text>
        </TwView>
        <Progress value={item.paidPercent} indicatorColor="var(--income)" accessibilityLabel={t('card.paidLabel', { percent: item.paidPercent })} className="mt-1" />
        <Text className="text-xs text-on-surface-variant">{t('card.paid', { amount: item.paid, percent: item.paidPercent })}</Text>
      </TwView>
      <TwView className="gap-0.5 border-t border-outline pt-2">
        <Text className="text-xs text-on-surface-variant">{facts.join(' · ')}</Text>
        {item.nextPayment ? (
          <Text weight="medium" className="text-xs">
            {t('card.nextPayment', { date: item.nextPayment })}
          </Text>
        ) : null}
        {item.dueLabel ? (
          <Text weight="medium" className={cn('text-xs', item.overdue ? 'text-expense' : 'text-on-background')}>
            {item.dueLabel}
          </Text>
        ) : null}
      </TwView>
    </TwPressable>
  );
}
