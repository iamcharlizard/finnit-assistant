import { useTranslations } from 'use-intl';

import { Badge } from '@finnit/ui-native/components/ui/badge';

/** "Conectada" (imported from a bank), "Manual", "Archivada" or "Tu efectivo". */
export function AccountStatusBadge({
  linked,
  archived,
  defaultCash,
}: {
  linked: boolean;
  archived?: boolean;
  defaultCash?: boolean;
}) {
  const t = useTranslations('accounts.status');
  if (defaultCash) return <Badge variant="muted" label={t('defaultCash')} />;
  if (archived) return <Badge variant="outline" label={t('archived')} />;
  return linked ? <Badge variant="success" label={t('linked')} /> : <Badge variant="muted" label={t('manual')} />;
}
