'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BellOff, CheckCheck } from 'lucide-react';

import { FilterChipGroup } from '@finnit/ui/components/finance/filter-chip-group';
import { Button } from '@finnit/ui/components/ui/button';

import { EmptyState } from '@/components/finance/empty-state';
import { useNotificationActions } from '@/hooks/use-notification-actions';
import { todayKey } from '@/lib/finance/dates';
import type { Connection } from '@/lib/finance/types';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import {
  NOTIFICATIONS_QUERY,
  PAGE_SIZE,
  toNotificationPage,
  type ApiNotification,
  type NotificationFilter,
  type NotificationItem,
  type NotificationPage,
} from '@/lib/notifications/view';
import { NotificationRow } from './notification-row';

/** /notifications: every notification, all or unread, with "Cargar más". */
export function NotificationsScreen({
  initial,
  filter,
}: {
  initial: NotificationPage;
  filter: NotificationFilter;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const l = useLocalizer();
  const t = useTranslations('notifications');
  const [items, setItems] = React.useState(initial.items);
  const [page, setPage] = React.useState({
    endCursor: initial.endCursor,
    hasNextPage: initial.hasNextPage,
    totalCount: initial.totalCount,
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const updateItems = React.useCallback(
    (change: (items: NotificationItem[]) => NotificationItem[]) =>
      setItems(change),
    [],
  );
  const { open, markAll, markingAll } = useNotificationActions(updateItems);

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const data = await gql<{ notifications: Connection<ApiNotification> }>(
        NOTIFICATIONS_QUERY,
        {
          first: PAGE_SIZE,
          after: page.endCursor,
          unread: filter === 'unread' || null,
        },
      );
      const next = toNotificationPage(data.notifications, todayKey(), l);
      setItems((current) => [...current, ...next.items]);
      setPage({
        endCursor: next.endCursor,
        hasNextPage: next.hasNextPage,
        totalCount: next.totalCount,
      });
    } catch (e) {
      setError(requestErrorMessage(e, l.t));
    } finally {
      setLoading(false);
    }
  }

  const unread = items.some((item) => item.unread);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="mb-1 text-[32px] font-bold text-on-background">
          {t('title')}
        </h1>
        <p className="text-sm text-on-surface-variant">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChipGroup
          aria-label={t('filterLabel')}
          items={[
            { value: 'all', label: t('filters.all') },
            { value: 'unread', label: t('filters.unread') },
          ]}
          activeValue={filter}
          onSelect={(value) =>
            router.push(
              value === 'unread' ? `${pathname}?filter=unread` : pathname,
            )
          }
        />
        {unread ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={markingAll}
            onClick={() => void markAll()}
          >
            <CheckCheck aria-hidden /> {t('markAllRead')}
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={filter === 'unread' ? t('emptyUnread') : t('empty')}
          description={t('emptyDescription')}
        />
      ) : (
        <>
          <p
            className="px-1 text-xs text-on-surface-variant"
            aria-live="polite"
          >
            {t('count', {
              shown: String(items.length),
              total: page.totalCount,
            })}
          </p>
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onOpen={(i) => void open(i)}
              />
            ))}
          </div>
        </>
      )}
      {error ? (
        <p role="alert" className="text-sm text-expense">
          {error}
        </p>
      ) : null}
      {page.hasNextPage ? (
        <Button
          variant="outline"
          onClick={() => void loadMore()}
          disabled={loading}
        >
          {loading ? l.t('common.loading') : l.t('common.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
