import { notFound } from 'next/navigation';

import { getCurrentUser, isAdmin } from '@/lib/auth/session';

/**
 * /admin exists only for admins: everyone else gets a plain 404. The API
 * checks the role again on every admin query and mutation. Its screens are
 * in the sidebar ("Usuarios" and "Configuración global"); the top bar
 * shows each one's title.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) notFound();
  return <div className="flex flex-col gap-5">{children}</div>;
}
