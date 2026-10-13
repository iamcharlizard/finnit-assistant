import type { Metadata } from 'next';

import { AdminAiScreen } from '@/components/admin/admin-ai-screen';

export const metadata: Metadata = { title: 'IA · Administración' };

export default function AdminAiPage() {
  return <AdminAiScreen />;
}
