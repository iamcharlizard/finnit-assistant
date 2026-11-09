import { useTranslations } from 'use-intl';
import {
  Bell,
  CalendarClock,
  ChevronRight,
  CreditCard,
  Landmark,
  PiggyBank,
  Scale,
  Scissors,
  Tags,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react-native';

import type { NotificationItem } from '@finnit/core/notifications/view';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

const ICONS: Record<string, LucideIcon> = {
  recurring: CalendarClock,
  budget: PiggyBank,
  debt_due: Landmark,
  summary: Bell,
  balance_mismatch: Scale,
  uncategorized: Tags,
  card_statement: Scissors,
  card_due: CreditCard,
  card_unpaid: TriangleAlert,
};

/** A notification; unread ones are highlighted. A tap marks it read and opens what it's about. */
export function NotificationRow({
  item,
  onOpen,
}: {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
}) {
  const t = useTranslations('notifications');
  return (
    <TwPressable
      accessibilityRole="button"
      accessibilityLabel={`${item.unread ? `${t('unread')}, ` : ''}${item.title}. ${item.message}`}
      onPress={() => onOpen(item)}
      className={cn(
        'w-full flex-row items-start gap-3 rounded-2xl p-3 active:bg-accent',
        item.unread ? 'bg-brand-8 dark:bg-accent-neon-10' : 'bg-surface',
      )}
    >
      <TwView
        className={cn(
          'size-10 shrink-0 items-center justify-center rounded-chip',
          item.unread ? 'bg-brand-15' : 'bg-track',
        )}
      >
        <Icon
          icon={ICONS[item.type] ?? Bell}
          size={20}
          color={item.unread ? '--brand-ink' : '--on-surface-variant'}
        />
      </TwView>
      <TwView className="min-w-0 flex-1">
        <TwView className="flex-row items-center gap-2">
          {item.unread ? (
            <TwView className="size-2 shrink-0 rounded-full bg-expense" />
          ) : null}
          <Text
            weight={item.unread ? 'bold' : 'medium'}
            className="min-w-0 flex-1 text-sm"
          >
            {item.title}
          </Text>
        </TwView>
        <Text className="mt-0.5 text-xs text-on-surface-variant">
          {item.message}
        </Text>
        <Text className="mt-1 text-[11px] text-on-surface-variant">
          {t(`types.${item.type}`)} · {item.when}
        </Text>
      </TwView>
      {item.href ? (
        <Icon icon={ChevronRight} size={16} color="--on-surface-variant" />
      ) : null}
    </TwPressable>
  );
}
