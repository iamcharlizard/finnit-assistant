import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { MoneyFormatProvider } from '@finnit/ui/components/ui/money-input';

import { AppShell } from '@/components/app-shell';
import { AmountsVisibilityProvider } from '@/components/privacy/amounts-visibility';
import { SessionProvider } from '@/components/session-provider';
import { getCurrentUser } from '@/lib/auth/session';
import { MONEY_COUNTRY } from '@finnit/core/finance/money';
import {
  NAV_GROUPS_COOKIE,
  SIDEBAR_COOKIE,
  parseOpenGroups,
  parseSidebarCollapsed,
} from '@finnit/core/nav/sidebar';
import { unreadNotificationCount } from '@/lib/notifications/unread';
import {
  HIDE_AMOUNTS_COOKIE,
  PIN_SUGGESTION_COOKIE,
  parseHideAmounts,
  parsePinSuggestionDismissed,
} from '@finnit/core/privacy/amounts';

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // proxy.ts already redirects visitors without a session; this also covers
  // a token the API no longer accepts (e.g. the user was deleted).
  const [user, unread, store] = await Promise.all([
    getCurrentUser(),
    unreadNotificationCount(),
    cookies(),
  ]);
  if (!user) redirect('/login');
  const sidebarCollapsed = parseSidebarCollapsed(
    store.get(SIDEBAR_COOKIE)?.value,
  );
  const openNavGroups = parseOpenGroups(store.get(NAV_GROUPS_COOKIE)?.value);

  return (
    <SessionProvider user={user}>
      <MoneyFormatProvider country={MONEY_COUNTRY}>
        <AmountsVisibilityProvider
          initialHidden={parseHideAmounts(
            store.get(HIDE_AMOUNTS_COOKIE)?.value,
          )}
          suggestionDismissed={parsePinSuggestionDismissed(
            store.get(PIN_SUGGESTION_COOKIE)?.value,
          )}
        >
          <AppShell
            notificationCount={unread}
            sidebarCollapsed={sidebarCollapsed}
            openNavGroups={openNavGroups}
          >
            {children}
          </AppShell>
        </AmountsVisibilityProvider>
      </MoneyFormatProvider>
    </SessionProvider>
  );
}
