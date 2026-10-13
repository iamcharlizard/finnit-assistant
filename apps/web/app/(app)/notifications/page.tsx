import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { NotificationsScreen } from '@/components/notifications/notifications-screen';
import { loadNotifications } from '@/lib/notifications/load';
import { parseNotificationFilter } from '@/lib/notifications/view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.notifications') };
}

export default async function NotificationsPage({
  searchParams,
}: PageProps<'/notifications'>) {
  const filter = parseNotificationFilter((await searchParams).filter);
  return (
    // A new filter is a new first page: start the list over.
    <NotificationsScreen
      key={filter}
      initial={await loadNotifications(filter)}
      filter={filter}
    />
  );
}
