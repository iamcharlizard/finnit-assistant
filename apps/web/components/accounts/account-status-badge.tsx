import { useTranslations } from 'next-intl';
import { Archive, Link2, PencilLine } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';

/** "Conectada" (imported from a bank), "Manual" or "Archivada". */
export function AccountStatusBadge({
  linked,
  archived,
}: {
  linked: boolean;
  archived?: boolean;
}) {
  const t = useTranslations('accounts.status');
  if (archived) {
    return (
      <Badge variant="outline">
        <Archive aria-hidden /> {t('archived')}
      </Badge>
    );
  }
  return linked ? (
    <Badge variant="success">
      <Link2 aria-hidden /> {t('linked')}
    </Badge>
  ) : (
    <Badge variant="muted">
      <PencilLine aria-hidden /> {t('manual')}
    </Badge>
  );
}
