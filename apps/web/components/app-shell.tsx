'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { TopAppBar } from '@finnit/ui/components/navigation/top-app-bar';
import { Toaster } from '@finnit/ui/components/ui/toaster';

import { AppBottomNav } from '@/components/navigation/app-bottom-nav';
import { AppSideNav } from '@/components/navigation/app-side-nav';
import { NewEntrySheet } from '@/components/new-entry/new-entry-sheet';
import { NotificationsSheet } from '@/components/notifications/notifications-sheet';
import { initials, useSessionUser } from '@/components/session-provider';
import { activeNavHref, visibleSections } from '@/lib/nav/sections';
import { pageTitleKey } from '@/lib/nav/titles';

export function AppShell({
  children,
  notificationCount,
}: {
  children: React.ReactNode;
  notificationCount: number;
}) {
  const pathname = usePathname();
  const user = useSessionUser();
  const t = useTranslations('pageTitles');
  const tu = useTranslations('ui');
  const sections = React.useMemo(
    () => visibleSections(user.role === 'admin'),
    [user.role],
  );
  const activeHref = activeNavHref(
    sections.flatMap((s) => s.items.map((i) => i.href)),
    pathname,
  );
  // "Nuevo movimiento" (the "+" buttons).
  const [adding, setAdding] = React.useState(false);
  const handleAdd = () => setAdding(true);
  // The bell's panel (latest notifications).
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);

  return (
    <div className="flex min-h-dvh bg-background">
      <AppSideNav
        sections={sections}
        activeHref={activeHref}
        onAddClick={handleAdd}
        className="sticky top-0 hidden h-dvh shrink-0 lg:flex"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopAppBar
          title={t(pageTitleKey(pathname))}
          notificationCount={notificationCount}
          onNotificationsClick={() => setNotificationsOpen(true)}
          avatarFallback={initials(user.name)}
          notificationsLabel={(count) =>
            count > 0
              ? tu('notificationsUnread', { count })
              : tu('notifications')
          }
          profileLabel={tu('userProfile')}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      <AppBottomNav
        sections={sections}
        activeHref={activeHref}
        onAddClick={handleAdd}
        className="lg:hidden"
      />
      <NewEntrySheet open={adding} onOpenChange={setAdding} />
      <NotificationsSheet
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        unreadCount={notificationCount}
      />
      <Toaster position="top-center" closeButton={false} />
    </div>
  );
}
