import { redirect } from 'next/navigation';

/** The old route of the AI settings, now under "Configuración global". */
export default function OldAdminAiPage() {
  redirect('/admin/settings/ai');
}
