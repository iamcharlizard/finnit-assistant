import type { Metadata } from 'next';

import { AdminUsersScreen } from '@/components/admin/admin-users-screen';

export const metadata: Metadata = { title: 'Usuarios · Administración' };

export default function AdminUsersPage() {
  return <AdminUsersScreen />;
}
