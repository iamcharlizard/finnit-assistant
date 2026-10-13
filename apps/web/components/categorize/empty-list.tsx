'use client';

import { Inbox, PartyPopper, Sparkles } from 'lucide-react';

import { EmptyState } from '@/components/finance/empty-state';
import {
  categorizeHref,
  type CategorizeFilters,
} from '@/lib/categorize/filters';
import type { DayKey } from '@/lib/finance/dates';
import { useLocalizer } from '@/lib/i18n/client';

/** Nothing to show: all categorized 🎉, no suggestions, or no movements. */
export function EmptyList({
  filters,
  today,
}: {
  filters: CategorizeFilters;
  today: DayKey;
}) {
  const { t } = useLocalizer();
  const allTime =
    filters.period !== 'all'
      ? {
          href: categorizeHref({ ...filters, period: 'all' }, today),
          label: t('categorize.empty.seeAllTime'),
        }
      : undefined;
  if (filters.show === 'uncategorized') {
    return (
      <EmptyState
        icon={PartyPopper}
        title={t('categorize.empty.uncategorizedTitle')}
        description={t('categorize.empty.uncategorizedDescription')}
        action={allTime}
      />
    );
  }
  if (filters.show === 'suggested') {
    return (
      <EmptyState
        icon={Sparkles}
        title={t('categorize.empty.suggestedTitle')}
        description={t('categorize.empty.suggestedDescription')}
      />
    );
  }
  return (
    <EmptyState
      icon={Inbox}
      title={t('categorize.empty.allTitle')}
      description={t('categorize.empty.allDescription')}
      action={allTime}
    />
  );
}
