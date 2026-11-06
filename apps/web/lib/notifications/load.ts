import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { todayKey } from '@finnit/core/finance/dates';
import type { Connection } from '@finnit/core/finance/types';
import { getLocalizer } from '@/lib/i18n/server';
import {
  NOTIFICATIONS_QUERY,
  PAGE_SIZE,
  toNotificationPage,
  type ApiNotification,
  type NotificationFilter,
  type NotificationPage,
} from '@finnit/core/notifications/view';

/** First page of /notifications for the filter. */
export async function loadNotifications(
  filter: NotificationFilter,
): Promise<NotificationPage> {
  const [data, l] = await Promise.all([
    serverGraphql<{ notifications: Connection<ApiNotification> }>(
      NOTIFICATIONS_QUERY,
      { first: PAGE_SIZE, after: null, unread: filter === 'unread' || null },
    ),
    getLocalizer(),
  ]);
  return toNotificationPage(data.notifications, todayKey(), l);
}
