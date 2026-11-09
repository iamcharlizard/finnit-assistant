import { useTranslations } from 'next-intl';
import { Archive, CircleSlash, Link2, PencilLine, Wallet } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';

/**
 * "Conectada" (imported from a bank), "Manual", "Archivada" or "Tu efectivo"
 * (the cash account every user has).
 */
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
  if (defaultCash) {
    return (
      <Badge variant="muted">
        <Wallet aria-hidden /> {t('defaultCash')}
      </Badge>
    );
  }
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

/** The account doesn't add up to the total balance (the user left it out). */
export function ExcludedFromTotalBadge() {
  const t = useTranslations('accounts.inTotal');
  return (
    <Badge variant="outline">
      <CircleSlash aria-hidden /> {t('excluded')}
    </Badge>
  );
}
