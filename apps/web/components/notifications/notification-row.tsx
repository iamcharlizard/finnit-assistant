'use client';

import { useTranslations } from 'next-intl';
import {
  Bell,
  CalendarClock,
  ChevronRight,
  Landmark,
  PiggyBank,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@finnit/ui/lib/utils';

import type {
  NotificationItem,
  NotificationType,
} from '@/lib/notifications/view';

const ICONS: Record<NotificationType, LucideIcon> = {
  recurring: CalendarClock,
  budget: PiggyBank,
  debt_due: Landmark,
  summary: Bell,
};

/** A notification; unread ones are highlighted. Clicking marks it read and opens what it's about. */
export function NotificationRow({
  item,
  onOpen,
}: {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
}) {
  const t = useTranslations('notifications');
  const Icon = ICONS[item.type] ?? Bell;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        'flex w-full items-start gap-3 rounded-2xl p-3 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
        item.unread ? 'bg-brand/8 dark:bg-accent-neon/10' : 'bg-surface',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-chip',
          item.unread
            ? 'bg-brand/15 text-brand-ink'
            : 'bg-track text-on-surface-variant',
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {item.unread ? (
            <span
              className="size-2 shrink-0 rounded-full bg-expense"
              aria-label={t('unread')}
              role="img"
            />
          ) : null}
          <span
            className={cn(
              'min-w-0 text-sm break-words text-on-background',
              item.unread ? 'font-bold' : 'font-medium',
            )}
          >
            {item.title}
          </span>
        </span>
        <span className="mt-0.5 block text-xs break-words text-on-surface-variant">
          {item.message}
        </span>
        <span className="mt-1 block text-[11px] text-on-surface-variant">
          {t(`types.${item.type}`)} · {item.when}
        </span>
      </span>
      {item.href ? (
        <ChevronRight
          aria-hidden
          className="mt-2 size-4 shrink-0 text-on-surface-variant"
        />
      ) : null}
    </button>
  );
}
