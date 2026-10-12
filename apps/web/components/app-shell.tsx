'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BottomNavBar } from '@finnit/ui/components/navigation/bottom-nav-bar';
import { SideNav } from '@finnit/ui/components/navigation/side-nav';
import { TopAppBar } from '@finnit/ui/components/navigation/top-app-bar';

import { BOTTOM_NAV_ITEMS, PAGE_TITLES, SIDE_NAV_ITEMS } from '@/lib/nav';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // TODO: open the add-transaction flow once the form exists.
  const handleAdd = () => {};

  return (
    <div className="flex min-h-dvh bg-background">
      <SideNav
        items={SIDE_NAV_ITEMS}
        activeHref={pathname}
        linkComponent={Link}
        onAddClick={handleAdd}
        className="sticky top-0 hidden h-dvh shrink-0 lg:flex"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopAppBar
          title={PAGE_TITLES[pathname] ?? 'Finnit'}
          notificationCount={2}
          avatarFallback="AN"
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      <BottomNavBar
        items={BOTTOM_NAV_ITEMS}
        activeHref={pathname}
        linkComponent={Link}
        onAddClick={handleAdd}
        className="lg:hidden"
      />
    </div>
  );
}
