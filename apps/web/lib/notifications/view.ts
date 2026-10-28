import type { Localizer } from '@/lib/i18n/translator';
import {
  dayKeyOf,
  daysBetween,
  isDayKey,
  relativeDayLabel,
  shortDate,
  timeOf,
  type DayKey,
} from '@/lib/finance/dates';
import type { Connection } from '@/lib/finance/types';

export type NotificationType = 'budget' | 'debt_due' | 'recurring' | 'summary';
export type NotificationStatus = 'scheduled' | 'sent' | 'read' | 'dismissed';

export interface ApiNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  status: NotificationStatus;
  relatedEntityId: string | null;
  relatedEntityType: string | null;
  createdAt: string;
}

export const NOTIFICATION_FIELDS =
  'id type title message status relatedEntityId relatedEntityType createdAt';

/** The bell's panel and the page show this many at a time. */
export const LATEST_COUNT = 10;
export const PAGE_SIZE = 20;

export type NotificationFilter = 'all' | 'unread';

export function parseNotificationFilter(value: unknown): NotificationFilter {
  return value === 'unread' ? 'unread' : 'all';
}

/** One page; `unread: true` lists only those not read yet. */
export const NOTIFICATIONS_QUERY = `query Notifications($first: Int!, $after: String, $unread: Boolean) {
  notifications(first: $first, after: $after, unread: $unread) {
    totalCount
    edges { node { ${NOTIFICATION_FIELDS} } }
    pageInfo { endCursor hasNextPage }
  }
}`;

export const MARK_READ_MUTATION = `mutation MarkNotificationAsRead($id: String!) { markNotificationAsRead(id: $id) }`;

export const MARK_ALL_READ_MUTATION = `mutation MarkAllNotificationsAsRead { markAllNotificationsAsRead }`;

export function isUnread(status: NotificationStatus): boolean {
  return status === 'scheduled' || status === 'sent';
}

/**
 * Where a notification takes you, when it's about something with a screen:
 * a recurring payment's reminder opens its day in /recurring, budgets and
 * debts their planning screens. Summaries have nowhere to go.
 */
export function notificationHref(
  n: Pick<ApiNotification, 'type' | 'relatedEntityId' | 'relatedEntityType'>,
): string | null {
  switch (n.type) {
    case 'recurring': {
      // relatedEntityId of a reminder is "<expense id>:<due day>".
      const day = n.relatedEntityId?.split(':')[1];
      return isDayKey(day) ? `/recurring?date=${day}` : '/recurring';
    }
    case 'budget':
      return '/planning/budgets';
    case 'debt_due':
      return '/planning/debts';
    default:
      return null;
  }
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  unread: boolean;
  /** "Hoy · 09:15", "Hace 3 días", "12 oct" */
  when: string;
  href: string | null;
}

/** Older than this shows the date instead of "Hace N días". */
const RELATIVE_DAYS = 6;

export function notificationWhen(
  createdAt: string,
  today: DayKey,
  { locale }: Pick<Localizer, 'locale'>,
): string {
  const day = dayKeyOf(createdAt);
  const age = daysBetween(day, today);
  if (age < 0 || age > RELATIVE_DAYS) return shortDate(day, locale);
  const relative = relativeDayLabel(day, today, locale);
  const time = timeOf(createdAt);
  return age <= 1 && time ? `${relative} · ${time}` : relative;
}

export function toNotificationItem(
  n: ApiNotification,
  today: DayKey,
  l: Pick<Localizer, 'locale'>,
): NotificationItem {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    unread: isUnread(n.status),
    when: notificationWhen(n.createdAt, today, l),
    href: notificationHref(n),
  };
}

export interface NotificationPage {
  items: NotificationItem[];
  totalCount: number;
  endCursor: string | null;
  hasNextPage: boolean;
}

export function toNotificationPage(
  connection: Connection<ApiNotification>,
  today: DayKey,
  l: Pick<Localizer, 'locale'>,
): NotificationPage {
  return {
    items: connection.edges.map((e) => toNotificationItem(e.node, today, l)),
    totalCount: connection.totalCount,
    endCursor: connection.pageInfo.endCursor,
    hasNextPage: connection.pageInfo.hasNextPage,
  };
}

/** The item after marking it read (the list updates without refetching). */
export function markedRead<T extends { id: string; unread: boolean }>(
  items: ReadonlyArray<T>,
  id: string | 'all',
): T[] {
  return items.map((item) =>
    id === 'all' || item.id === id ? { ...item, unread: false } : item,
  );
}
