import { redirect } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { SessionProvider } from '@/components/session-provider';
import { getCurrentUser } from '@/lib/auth/session';

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // proxy.ts already redirects visitors without a session; this also covers
  // a token the API no longer accepts (e.g. the user was deleted).
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <SessionProvider user={user}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
