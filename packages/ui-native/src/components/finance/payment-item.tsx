import type { LucideIcon } from 'lucide-react-native';

import { cn } from '../../lib/utils';
import { TwPressable, TwView } from '../../lib/tw';
import { Text } from '../ui/text';

type PaymentStatus = 'pending' | 'scheduled' | 'paid';

interface PaymentItemProps {
  title: string;
  amount: string;
  status: PaymentStatus;
  /** The status badge's text (translated by the app). */
  statusLabel: string;
  timeLabel: string;
  icon: LucideIcon;
  iconBg: string;
  iconTint?: string;
  onPress?: () => void;
  className?: string;
}

const STATUS: Record<PaymentStatus, { container: string; badge: string; badgeText: string; amount: string }> = {
  pending: {
    container: 'border-[rgba(0,245,255,0.3)] bg-[rgba(0,245,255,0.06)] dark:border-[rgba(0,245,255,0.25)] dark:bg-[rgba(0,245,255,0.08)]',
    badge: 'bg-brand dark:bg-[#00f5ff]',
    badgeText: 'text-brand-foreground dark:text-[#00363a]',
    amount: 'text-brand-ink dark:text-[#00f5ff]',
  },
  scheduled: {
    container: 'border-glass-border bg-track',
    badge: 'bg-track',
    badgeText: 'text-on-background',
    amount: 'text-on-background',
  },
  paid: {
    container: 'border-glass-border',
    badge: 'bg-[rgba(34,197,94,0.15)] dark:bg-[rgba(34,197,94,0.2)]',
    badgeText: 'text-green-800 dark:text-green-400',
    amount: 'text-on-background',
  },
};

/** A recurring payment due on a day, like @finnit/ui's PaymentItem. */
function PaymentItem({
  title,
  amount,
  status,
  statusLabel,
  timeLabel,
  icon: Glyph,
  iconBg,
  iconTint = '#ffffff',
  onPress,
  className,
}: PaymentItemProps) {
  const config = STATUS[status];
  return (
    <TwPressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}, ${amount}, ${statusLabel}, ${timeLabel}`}
      onPress={onPress}
      disabled={!onPress}
      className={cn('min-h-11 w-full flex-row items-center gap-3 rounded-2xl border p-3 active:bg-accent', config.container, className)}
    >
      <TwView className="size-12 shrink-0 items-center justify-center rounded-chip" style={{ backgroundColor: iconBg }}>
        <Glyph size={22} color={iconTint} />
      </TwView>
      <TwView className="min-w-0 flex-1">
        <Text weight="bold" numberOfLines={1} className="text-sm text-on-background">
          {title}
        </Text>
        <TwView className="mt-1 flex-row flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <TwView className={cn('rounded-full px-1.5 py-0.5', config.badge)}>
            <Text weight="bold" className={cn('text-[8px] uppercase tracking-wide', config.badgeText)}>
              {statusLabel}
            </Text>
          </TwView>
          <Text numberOfLines={1} className="text-[11px] text-on-surface-variant">
            {timeLabel}
          </Text>
        </TwView>
      </TwView>
      <Text weight="bold" numberOfLines={1} className={cn('shrink-0 text-sm', config.amount)}>
        {amount}
      </Text>
    </TwPressable>
  );
}

export { PaymentItem, type PaymentItemProps, type PaymentStatus };
