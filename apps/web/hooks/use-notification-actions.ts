'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { toast } from '@finnit/ui/components/ui/toaster';

import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import {
  MARK_ALL_READ_MUTATION,
  MARK_READ_MUTATION,
  markedRead,
  type NotificationItem,
} from '@/lib/notifications/view';

/**
 * Opening a notification (marks it read, then goes where it points) and
 * "Marcar todas como leídas". Both refresh the server components so the
 * bell's unread count follows.
 */
export function useNotificationActions(
  /** Applies a change to the shown items (stable callback). */
  updateItems: (
    change: (items: NotificationItem[]) => NotificationItem[],
  ) => void,
  { onNavigate }: { onNavigate?: () => void } = {},
) {
  const router = useRouter();
  const { t } = useLocalizer();
  const [markingAll, setMarkingAll] = React.useState(false);

  const open = React.useCallback(
    async (item: NotificationItem) => {
      if (item.unread) {
        updateItems((items) => markedRead(items, item.id));
        try {
          await gql(MARK_READ_MUTATION, { id: item.id });
        } catch (error) {
          toast.error(requestErrorMessage(error, t));
        }
        router.refresh();
      }
      if (item.href) {
        onNavigate?.();
        router.push(item.href);
      }
    },
    [onNavigate, router, updateItems, t],
  );

  const markAll = React.useCallback(async () => {
    setMarkingAll(true);
    try {
      await gql(MARK_ALL_READ_MUTATION);
      updateItems((items) => markedRead(items, 'all'));
      toast.success(t('notifications.allRead'));
      router.refresh();
    } catch (error) {
      toast.error(requestErrorMessage(error, t));
    } finally {
      setMarkingAll(false);
    }
  }, [router, updateItems, t]);

  return { open, markAll, markingAll };
}
