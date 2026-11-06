'use client';

import { useTranslations } from 'next-intl';

import { SuggestionChip as Chip } from '@finnit/ui/components/finance/suggestion-chip';

/** "Sugerencia: Restaurantes ✓ ✕" inside a row with a pending AI suggestion. */
export function SuggestionChip({
  label,
  busy,
  onAccept,
  onReject,
}: {
  label: string;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const t = useTranslations('categorize');
  return (
    <Chip
      text={t('suggestion', { category: label })}
      acceptLabel={t('acceptSuggestion', { category: label })}
      rejectLabel={t('rejectSuggestion', { category: label })}
      busy={busy}
      onAccept={onAccept}
      onReject={onReject}
    />
  );
}
