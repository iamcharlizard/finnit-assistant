import * as React from 'react';
import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { BellOff, CheckCheck } from 'lucide-react-native';

import { todayKey } from '@finnit/core/finance/dates';
import type { Connection } from '@finnit/core/finance/types';
import { requestErrorMessage } from '@finnit/core/graphql/request';
import {
  MARK_ALL_READ_MUTATION,
  MARK_READ_MUTATION,
  NOTIFICATIONS_QUERY,
  PAGE_SIZE,
  markedRead,
  toNotificationPage,
  type ApiNotification,
  type NotificationFilter,
  type NotificationItem,
} from '@finnit/core/notifications/view';
import { TwView } from '@finnit/ui-native/lib/tw';
import { FilterChipGroup } from '@finnit/ui-native/components/finance/filter-chip-group';
import { Button } from '@finnit/ui-native/components/ui/button';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { NotificationRow } from '@/components/notifications/notification-row';
import { Screen } from '@/components/shell/screen';
import { useGql } from '@/lib/graphql/runner';
import { useView } from '@/lib/graphql/use-view';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { emitNotificationsChanged } from '@/lib/notifications/events';
import { appHref } from '@/lib/nav/app-href';

/** Notificaciones: all or unread, mark as read, "Cargar más" (the web's /notifications). */
export function NotificationsScreen() {
  const t = useTranslations('notifications');
  const tc = useTranslations('common');
  const l = useLocalizer();
  const gql = useGql();
  const router = useRouter();
  const [filter, setFilter] = React.useState<NotificationFilter>('all');
  const today = todayKey();
  const { view, loading, error, refreshing, refresh } = useView({
    query: NOTIFICATIONS_QUERY,
    variables: { first: PAGE_SIZE, after: null, unread: filter === 'unread' || null },
    build: (data: { notifications: Connection<ApiNotification> }, loc) => toNotificationPage(data.notifications, today, loc),
  });
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [page, setPage] = React.useState({ endCursor: null as string | null, hasNextPage: false, totalCount: 0 });
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [markingAll, setMarkingAll] = React.useState(false);
  React.useEffect(() => {
    if (!view) return;
    setItems(view.items);
    setPage({ endCursor: view.endCursor, hasNextPage: view.hasNextPage, totalCount: view.totalCount });
  }, [view]);

  async function open(item: NotificationItem) {
    if (item.unread) {
      setItems((current) => markedRead(current, item.id));
      try {
        await gql(MARK_READ_MUTATION, { id: item.id });
        emitNotificationsChanged();
      } catch (e) {
        toast.error(requestErrorMessage(e, l.t));
      }
    }
    if (item.href) router.push(appHref(item.href));
  }

  async function markAll() {
    setMarkingAll(true);
    try {
      await gql(MARK_ALL_READ_MUTATION);
      setItems((current) => markedRead(current, 'all'));
      toast.success(t('allRead'));
      emitNotificationsChanged();
    } catch (e) {
      toast.error(requestErrorMessage(e, l.t));
    } finally {
      setMarkingAll(false);
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await gql<{ notifications: Connection<ApiNotification> }>(NOTIFICATIONS_QUERY, {
        first: PAGE_SIZE,
        after: page.endCursor,
        unread: filter === 'unread' || null,
      });
      const next = toNotificationPage(data.notifications, today, l);
      setItems((current) => [...current, ...next.items]);
      setPage({ endCursor: next.endCursor, hasNextPage: next.hasNextPage, totalCount: next.totalCount });
    } catch (e) {
      toast.error(requestErrorMessage(e, l.t));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Screen
      title={t('title')}
      subtitle={t('subtitle')}
      back
      withBottomNav={false}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <TwView className="gap-5">
        <TwView className="flex-row flex-wrap items-center justify-between gap-3">
          <FilterChipGroup
            accessibilityLabel={t('filterLabel')}
            items={[
              { value: 'all', label: t('filters.all') },
              { value: 'unread', label: t('filters.unread') },
            ]}
            activeValue={filter}
            onSelect={(value) => setFilter(value as NotificationFilter)}
          />
          {items.some((item) => item.unread) ? (
            <Button variant="ghost" size="sm" icon={CheckCheck} label={t('markAllRead')} disabled={markingAll} onPress={markAll} />
          ) : null}
        </TwView>
        {items.length === 0 ? (
          <EmptyState icon={BellOff} title={filter === 'unread' ? t('emptyUnread') : t('empty')} description={t('emptyDescription')} />
        ) : (
          <>
            <Text accessibilityLiveRegion="polite" className="px-1 text-xs text-on-surface-variant">
              {t('count', { shown: String(items.length), total: page.totalCount })}
            </Text>
            <TwView className="gap-2">
              {items.map((item) => (
                <NotificationRow key={item.id} item={item} onOpen={(i) => void open(i)} />
              ))}
            </TwView>
          </>
        )}
        {page.hasNextPage ? (
          <Button variant="outline" className="w-full" label={loadingMore ? tc('loading') : tc('loadMore')} disabled={loadingMore} onPress={loadMore} />
        ) : null}
      </TwView>
    </Screen>
  );
}
