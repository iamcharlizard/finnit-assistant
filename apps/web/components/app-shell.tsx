'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { TopAppBar } from '@finnit/ui/components/navigation/top-app-bar';
import { Toaster } from '@finnit/ui/components/ui/toaster';
import { cn } from '@finnit/ui/lib/utils';

import {
  HEADER_TRANSITION_CLASS,
  HeaderChromeContext,
  type HeaderChrome,
} from '@/components/header-chrome';
import { AppBottomNav } from '@/components/navigation/app-bottom-nav';
import { AppSideNav } from '@/components/navigation/app-side-nav';
import { ProfileMenu } from '@/components/navigation/profile-menu';
import { useNavGroups } from '@/components/navigation/use-nav-groups';
import { useSidebarState } from '@/components/navigation/use-sidebar-state';
import type { NewEntryAction } from '@/components/new-entry/new-entry-flow';
import { NewEntrySheet } from '@/components/new-entry/new-entry-sheet';
import { NotificationsSheet } from '@/components/notifications/notifications-sheet';
import { useSessionUser } from '@/components/session-provider';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  SETTINGS_HREF,
  activeGroupKey,
  activeNavHref,
  visibleSections,
} from '@/lib/nav/sections';
import { pageTitleKey } from '@/lib/nav/titles';

export function AppShell({
  children,
  notificationCount,
  sidebarCollapsed,
  openNavGroups,
}: {
  children: React.ReactNode;
  notificationCount: number;
  /** Desktop sidebar state from the cookie, so the server renders it. */
  sidebarCollapsed: boolean;
  /** Sidebar groups left open (cookie). */
  openNavGroups: ReadonlyArray<string>;
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
  // Open, optionally on a kind's form or the scanner (the mobile "+" menu).
  const [adding, setAdding] = React.useState<{
    action?: NewEntryAction;
  } | null>(null);
  const handleAdd = (action?: NewEntryAction) => setAdding({ action });
  const sidebar = useSidebarState(sidebarCollapsed);
  const groups = useNavGroups(
    openNavGroups,
    activeGroupKey(sections, activeHref),
  );
  // With the sidebar on the left (lg), toasts go to the bottom right, away
  // from the header; on phones and tablets they stay at the top.
  const wide = useMediaQuery('(min-width: 64rem)');
  const inSettings =
    pathname === SETTINGS_HREF || pathname.startsWith(`${SETTINGS_HREF}/`);
  // The bell's panel (latest notifications).
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const chrome = React.useMemo<HeaderChrome>(
    () => ({
      notificationCount,
      onNotificationsClick: () => setNotificationsOpen(true),
      notificationsLabel: (count) =>
        count > 0 ? tu('notificationsUnread', { count }) : tu('notifications'),
      // From lg the profile lives at the bottom of the sidebar.
      profile: <ProfileMenu variant="header" className="lg:hidden" />,
    }),
    [notificationCount, tu],
  );

  return (
    // No background here: the body's (with Glass's backdrop) shows through.
    <div className="flex min-h-dvh">
      <AppSideNav
        sections={sections}
        activeHref={activeHref}
        onAddClick={() => handleAdd()}
        collapsed={sidebar.collapsed}
        onToggle={sidebar.toggle}
        openGroups={groups.open}
        onToggleGroup={groups.toggle}
        footer={
          <ProfileMenu
            variant="sidebar"
            collapsed={sidebar.collapsed}
            active={inSettings}
          />
        }
        className="sticky top-3 z-40 my-3 ml-3 hidden h-[calc(100dvh-1.5rem)] shrink-0 lg:block"
      />

      {/*
        Header and page share the column width, so the floating bar lines up
        with the content. Screens with their own heading render <PageHeader>
        (class "page-header"); then the generic bar is hidden with :has(), which
        works from the first server render.
      */}
      <HeaderChromeContext.Provider value={chrome}>
        {/*
          The column is the container for the screens' @-queries: they lay
          out by the width left by the sidebar (expanded or collapsed), not
          by the window.
        */}
        <div className="group/shell @container mx-auto flex w-full max-w-[100rem] min-w-0 flex-1 flex-col px-4 pt-3 sm:px-6 lg:px-8">
          <TopAppBar
            {...chrome}
            title={t(pageTitleKey(pathname))}
            className={cn(
              'group-has-[.page-header]/shell:hidden',
              HEADER_TRANSITION_CLASS,
            )}
          />
          <main className="w-full flex-1 pt-5 pb-40 group-has-[.page-header]/shell:pt-0 lg:pb-10">
            {children}
          </main>
        </div>
      </HeaderChromeContext.Provider>

      <AppBottomNav
        sections={sections}
        activeHref={activeHref}
        onAdd={handleAdd}
        className="lg:hidden"
      />
      <NewEntrySheet
        open={adding !== null}
        onOpenChange={(open) => {
          if (!open) setAdding(null);
        }}
        initialAction={adding?.action}
      />
      <NotificationsSheet
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        unreadCount={notificationCount}
      />
      <Toaster
        position={wide ? 'bottom-right' : 'top-center'}
        closeButton={false}
      />
    </div>
  );
}
