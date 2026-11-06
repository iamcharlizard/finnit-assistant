'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Search, SlidersHorizontal, X } from 'lucide-react';

import { FilterChipGroup } from '@finnit/ui/components/finance/filter-chip-group';
import { Button } from '@finnit/ui/components/ui/button';
import { DatePicker } from '@finnit/ui/components/ui/date-picker';
import { InputWithIcon } from '@finnit/ui/components/ui/input-with-icon';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@finnit/ui/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@finnit/ui/components/ui/select';

import { MonthSwitcher } from '@/components/finance/month-switcher';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  monthLabel,
  monthOf,
  shortDate,
  type DayKey,
} from '@/lib/finance/dates';
import {
  TYPE_OPTIONS,
  hasFilters,
  hasRange,
  historyHref,
  historyQuery,
  monthLinks,
  moreFiltersCount,
  withPeriod,
  type HistoryFilters as Filters,
  type HistoryType,
} from '@/lib/history/filters';
import type { Option } from '@/lib/history/view';

const ALL = 'all';

/**
 * The history's toolbar, fixed under the header while the list scrolls:
 * search, type, the month (‹ Noviembre 2026 ›) and "Filtros" (account,
 * category, whole history or a date range). Every change updates the URL.
 */
export function HistoryFilters({
  filters,
  accounts,
  categories,
  today,
  aliasName,
}: {
  filters: Filters;
  accounts: Option[];
  categories: Option[];
  today: DayKey;
  /** The automatic name the list is filtered by (?alias=). */
  aliasName?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('history');
  const typeOptions = React.useMemo(
    () => TYPE_OPTIONS.map((value) => ({ value, label: t(`types.${value}`) })),
    [t],
  );
  const [search, setSearch] = React.useState(filters.search ?? '');
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const extra = moreFiltersCount(filters);
  const links = monthLinks(filters, today);

  const apply = React.useCallback(
    (next: Filters) => {
      router.replace(`${pathname}${historyQuery(next, today)}`, {
        scroll: false,
      });
    },
    [router, pathname, today],
  );

  React.useEffect(() => {
    if (debouncedSearch !== (filters.search ?? '')) {
      apply({ ...filters, search: debouncedSearch || undefined });
    }
  }, [debouncedSearch, filters, apply]);

  const backToMonth = () => apply(withPeriod(filters, monthOf(today)));

  return (
    <div className="glass sticky top-24 z-20 mb-6 flex flex-col gap-3 rounded-3xl border border-glass-border bg-surface/95 p-3 shadow-elevation backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <div role="search" className="min-w-0 flex-1">
          <InputWithIcon
            iconLeft={Search}
            type="search"
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchLabel')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="min-h-12 shrink-0"
              aria-label={t('moreFiltersLabel', { count: extra })}
            >
              <SlidersHorizontal aria-hidden />
              <span className="hidden sm:inline">{t('moreFilters')}</span>
              {extra > 0 ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-brand-foreground">
                  {extra}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 p-4"
          >
            <Select
              value={filters.accountId ?? ALL}
              onValueChange={(v) =>
                apply({ ...filters, accountId: v === ALL ? undefined : v })
              }
            >
              <SelectTrigger
                aria-label={t('account')}
                className="min-h-12 w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('allAccounts')}</SelectItem>
                {accounts.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.categoryId ?? ALL}
              onValueChange={(v) =>
                apply({ ...filters, categoryId: v === ALL ? undefined : v })
              }
            >
              <SelectTrigger
                aria-label={t('category')}
                className="min-h-12 w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('allCategories')}</SelectItem>
                {categories.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <p className="px-1 pt-1 text-xs font-medium text-on-surface-variant">
              {t('range')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <DatePicker
                aria-label={t('from')}
                placeholder={t('from')}
                value={filters.from}
                max={filters.to ?? today}
                locale={locale}
                displayFormat="d MMM yy"
                clearable
                clearLabel={t('clearDate')}
                onChange={(from) => apply({ ...filters, from })}
              />
              <DatePicker
                aria-label={t('to')}
                placeholder={t('to')}
                value={filters.to}
                min={filters.from}
                max={today}
                locale={locale}
                displayFormat="d MMM yy"
                clearable
                clearLabel={t('clearDate')}
                onChange={(to) => apply({ ...filters, to })}
              />
            </div>
            {filters.period !== 'all' && !hasRange(filters) ? (
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => apply(withPeriod(filters, 'all'))}
              >
                {t('allTime')}
              </Button>
            ) : null}

            {hasFilters(filters) ? (
              <Button
                variant="ghost"
                className="justify-start text-income"
                onClick={() => {
                  setSearch('');
                  apply({ period: filters.period });
                }}
              >
                <X aria-hidden /> {t('clearFilters')}
              </Button>
            ) : null}
          </PopoverContent>
        </Popover>
      </div>

      {filters.aliasId ? (
        <button
          type="button"
          onClick={() => apply({ ...filters, aliasId: undefined })}
          aria-label={t('clearAlias')}
          className="flex min-h-9 items-center gap-1.5 self-start rounded-full bg-primary/15 px-3 text-sm font-medium text-on-background hover:bg-primary/25"
        >
          {t('aliasFilter', { name: aliasName ?? '…' })}
          <X aria-hidden className="size-4" />
        </button>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterChipGroup
          items={typeOptions}
          activeValue={filters.type ?? ALL}
          onSelect={(v) =>
            apply({
              ...filters,
              type: v === ALL ? undefined : (v as HistoryType),
            })
          }
          aria-label={t('filterByType')}
        />
        {links && filters.period !== 'all' ? (
          <MonthSwitcher
            as="h2"
            compact
            label={monthLabel(filters.period, locale)}
            prevHref={historyHref(withPeriod(filters, links.prev), today)}
            nextHref={
              links.next
                ? historyHref(withPeriod(filters, links.next), today)
                : null
            }
          />
        ) : (
          <button
            type="button"
            onClick={backToMonth}
            aria-label={t('backToMonth')}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-track px-4 text-sm font-medium text-on-background hover:bg-accent"
          >
            {hasRange(filters)
              ? t('rangeLabel', {
                  from: filters.from ? shortDate(filters.from, locale) : '…',
                  to: filters.to ? shortDate(filters.to, locale) : '…',
                })
              : t('allTime')}
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
