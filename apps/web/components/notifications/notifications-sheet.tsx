'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { BellOff, CheckCheck } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@finnit/ui/components/ui/sheet';

import { useNotificationActions } from '@/hooks/use-notification-actions';
import { todayKey } from '@/lib/finance/dates';
import type { Connection } from '@/lib/finance/types';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import {
  LATEST_COUNT,
  NOTIFICATIONS_QUERY,
  toNotificationItem,
  type ApiNotification,
  type NotificationItem,
} from '@/lib/notifications/view';
import { NotificationRow } from './notification-row';

/**
 * The bell's panel: the latest notifications (unread highlighted), "Marcar
 * todas como leídas" and "Ver todas". Loads each time it opens.
 */
export function NotificationsSheet({
  open,
  onOpenChange,
  unreadCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unreadCount: number;
}) {
  const l = useLocalizer();
  const t = useTranslations('notifications');
  const [items, setItems] = React.useState<NotificationItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  const updateItems = React.useCallback(
    (change: (items: NotificationItem[]) => NotificationItem[]) =>
      setItems((items) => (items ? change(items) : items)),
    [],
  );
  const {
    open: openItem,
    markAll,
    markingAll,
  } = useNotificationActions(updateItems, { onNavigate: close });

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    gql<{ notifications: Connection<ApiNotification> }>(NOTIFICATIONS_QUERY, {
      first: LATEST_COUNT,
      after: null,
      unread: null,
    })
      .then((data) => {
        if (cancelled) return;
        const today = todayKey();
        setItems(
          data.notifications.edges.map((e) =>
            toNotificationItem(e.node, today, l),
          ),
        );
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(requestErrorMessage(e, l.t) || t('loadFailed'));
      });
    return () => {
      cancelled = true;
    };
  }, [open, l, t]);

  const hasUnread =
    unreadCount > 0 || Boolean(items?.some((item) => item.unread));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={l.t('common.close')}
        className="w-full max-w-full gap-3 px-4 pt-5 pb-4 sm:max-w-sm"
      >
        <div className="pr-12">
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription>{t('recent')}</SheetDescription>
        </div>

        {hasUnread ? (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            disabled={markingAll}
            onClick={() => void markAll()}
          >
            <CheckCheck aria-hidden /> {t('markAllRead')}
          </Button>
        ) : null}

        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1">
          {error ? (
            <p role="alert" className="text-sm text-expense">
              {error}
            </p>
          ) : items === null ? (
            <p className="text-sm text-on-surface-variant" aria-live="polite">
              {l.t('common.loading')}
            </p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <BellOff
                aria-hidden
                className="size-9 text-on-surface-variant/50"
              />
              <p className="text-sm font-medium text-on-background">
                {t('empty')}
              </p>
              <p className="text-xs text-on-surface-variant">
                {t('emptyDescription')}
              </p>
            </div>
          ) : (
            items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onOpen={(i) => void openItem(i)}
              />
            ))
          )}
        </div>

        <Button variant="outline" asChild>
          <Link href="/notifications" onClick={close}>
            {t('seeAll')}
          </Link>
        </Button>
      </SheetContent>
    </Sheet>
  );
}
