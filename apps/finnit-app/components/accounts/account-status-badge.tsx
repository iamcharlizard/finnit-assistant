import { useTranslations } from 'use-intl';

import { Badge } from '@finnit/ui-native/components/ui/badge';

/** "Conectada" (imported from a bank), "Manual" or "Archivada". */
export function AccountStatusBadge({ linked, archived }: { linked: boolean; archived?: boolean }) {
  const t = useTranslations('accounts.status');
  if (archived) return <Badge variant="outline" label={t('archived')} />;
  return linked ? <Badge variant="success" label={t('linked')} /> : <Badge variant="muted" label={t('manual')} />;
}
