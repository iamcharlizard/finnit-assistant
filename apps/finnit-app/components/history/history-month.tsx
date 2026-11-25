import {
  monthLabel,
  type DayKey,
  type MonthRef,
} from '@finnit/core/finance/dates';
import {
  monthLinks,
  withPeriod,
  type HistoryFilters as Filters,
} from '@finnit/core/history/filters';
import { TwView } from '@finnit/ui-native/lib/tw';

import { MonthSwitcher } from '@/components/finance/month-switcher';
import { useLocale } from '@/lib/i18n/i18n-provider';

/**
 * ‹ Noviembre 2026 ›, centered under the history's title, while the
 * history shows one month (not "Todo" or a range of dates).
 */
export function HistoryMonth({
  filters,
  today,
  onChange,
}: {
  filters: Filters;
  today: DayKey;
  onChange: (next: Filters) => void;
}) {
  const { locale } = useLocale();
  const links = monthLinks(filters, today);
  if (!links || filters.period === 'all') return null;
  return (
    <TwView className="items-center">
      <MonthSwitcher
        label={monthLabel(filters.period as MonthRef, locale)}
        onPrevious={() => onChange(withPeriod(filters, links.prev))}
        onNext={
          links.next ? () => onChange(withPeriod(filters, links.next!)) : null
        }
      />
    </TwView>
  );
}
