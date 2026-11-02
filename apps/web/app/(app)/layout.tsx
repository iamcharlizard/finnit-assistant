import { redirect } from 'next/navigation';

import { MoneyFormatProvider } from '@finnit/ui/components/ui/money-input';

import { AppShell } from '@/components/app-shell';
import { SessionProvider } from '@/components/session-provider';
import { getCurrentUser } from '@/lib/auth/session';
import { MONEY_COUNTRY } from '@/lib/finance/money';
import { unreadNotificationCount } from '@/lib/notifications/unread';

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // proxy.ts already redirects visitors without a session; this also covers
  // a token the API no longer accepts (e.g. the user was deleted).
  const [user, unread] = await Promise.all([
    getCurrentUser(),
    unreadNotificationCount(),
  ]);
  if (!user) redirect('/login');

  return (
    <SessionProvider user={user}>
      <MoneyFormatProvider country={MONEY_COUNTRY}>
        <AppShell notificationCount={unread}>{children}</AppShell>
      </MoneyFormatProvider>
    </SessionProvider>
  );
}
