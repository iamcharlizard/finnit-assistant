'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { InputWithIcon } from '@finnit/ui/components/ui/input-with-icon';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@finnit/ui/components/ui/popover';

import { HistoryFilterPanel } from '@/components/history/history-filter-panel';
import { HistoryMonth } from '@/components/history/history-month';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  monthOf,
  shortDate,
  type DayKey,
} from '@finnit/core/finance/dates';
import {
  activeFilterCount,
  hasFilters,
  hasRange,
  historyQuery,
  monthLinks,
  toggleValue,
  withPeriod,
  type HistoryFilters as Filters,
} from '@finnit/core/history/filters';
import type { Option } from '@finnit/core/history/view';

/**
 * The history's toolbar, fixed under the header while the list scrolls
 * (exactly where it starts, so it never moves; see useStickyTops): search
 * and the "Filtros" dropdown (accounts, categories, type and dates in
 * collapsible sections, with the active count above the button); the
 * filters in use as removable chips, and the month (‹ Noviembre 2026 ›).
 * Every change updates the URL.
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
  const tf = useTranslations('history.filters');
  const [search, setSearch] = React.useState(filters.search ?? '');
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const count = activeFilterCount(filters);
  // Below @3xl the month goes in the chips row.
  const showMonth =
    Boolean(monthLinks(filters, today)) && filters.period !== 'all';

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

  const labelOf = (options: Option[], id: string) =>
    options.find((o) => o.value === id)?.label ?? id;
  const datesLabel = hasRange(filters)
    ? t('rangeLabel', {
        from: filters.from ? shortDate(filters.from, locale) : '…',
        to: filters.to ? shortDate(filters.to, locale) : '…',
      })
    : filters.period === 'all'
      ? t('allTime')
      : null;

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...(filters.type
      ? [
          {
            key: 'type',
            label: t(`types.${filters.type}`),
            remove: () => apply({ ...filters, type: undefined }),
          },
        ]
      : []),
    ...(filters.accountIds ?? []).map((id) => ({
      key: `account:${id}`,
      label: labelOf(accounts, id),
      remove: () =>
        apply({
          ...filters,
          accountIds: toggleValue(filters.accountIds, id, false),
        }),
    })),
    ...(filters.categoryIds ?? []).map((id) => ({
      key: `category:${id}`,
      label: labelOf(categories, id),
      remove: () =>
        apply({
          ...filters,
          categoryIds: toggleValue(filters.categoryIds, id, false),
        }),
    })),
    ...(datesLabel
      ? [
          {
            key: 'dates',
            label: datesLabel,
            remove: () => apply(withPeriod(filters, monthOf(today))),
          },
        ]
      : []),
    ...(filters.aliasId
      ? [
          {
            key: 'alias',
            label: t('aliasFilter', { name: aliasName ?? '…' }),
            remove: () => apply({ ...filters, aliasId: undefined }),
          },
        ]
      : []),
  ];

  return (
    <div
      // Measured by useStickyTops: the day headings stick below it.
      data-history-toolbar=""
      className="glass sticky top-[var(--history-top,6rem)] z-20 mb-6 flex flex-col gap-3 rounded-3xl border border-glass-border bg-surface/95 p-3 shadow-elevation backdrop-blur-xl"
    >
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
          <div className="relative shrink-0">
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="min-h-12 data-[state=open]:border-brand/40 data-[state=open]:bg-brand/5"
                aria-label={t('moreFiltersLabel', { count })}
              >
                <SlidersHorizontal aria-hidden />
                <span className="hidden sm:inline">{t('moreFilters')}</span>
                <ChevronDown
                  aria-hidden
                  className="hidden text-on-surface-variant sm:block"
                />
              </Button>
            </PopoverTrigger>
            {count > 0 ? (
              <span
                aria-hidden
                className="pointer-events-none absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-brand-foreground shadow-sm ring-2 ring-surface"
              >
                {count > 9 ? '9+' : count}
              </span>
            ) : null}
          </div>
          <PopoverContent
            align="end"
            className="flex max-h-[min(36rem,var(--radix-popover-content-available-height))] w-[min(24rem,calc(100vw-2rem))] flex-col gap-1 p-0"
          >
            <div className="flex items-center justify-between gap-2 px-4 pt-3">
              <p className="text-sm font-bold text-on-background">
                {t('moreFilters')}
              </p>
              <button
                type="button"
                disabled={!hasFilters(filters)}
                onClick={() => {
                  setSearch('');
                  apply({ period: filters.period });
                }}
                className="rounded-md px-1 py-1 text-sm font-medium text-brand-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"
              >
                {tf('clearAll')}
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto px-3 pb-1">
              <HistoryFilterPanel
                filters={filters}
                accounts={accounts}
                categories={categories}
                today={today}
                onApply={apply}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/*
        The filters in use, and the month (from @3xl it sits above the top
        categories instead, so it takes no row here).
      */}
      {chips.length > 0 || showMonth ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="flex max-w-full items-center gap-1 rounded-full border border-brand/30 bg-brand/10 py-1 pr-1 pl-3 text-xs font-medium text-brand-ink"
            >
              <span className="truncate">{chip.label}</span>
              <button
                type="button"
                onClick={chip.remove}
                aria-label={tf('remove', { name: chip.label })}
                className="flex size-6 shrink-0 items-center justify-center rounded-full outline-none hover:bg-brand/15 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </span>
          ))}
          {hasFilters(filters) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                apply({ period: filters.period });
              }}
            >
              {t('clearFilters')}
            </Button>
          ) : null}
          {showMonth ? (
            <div className="-my-1 ml-auto @3xl:hidden">
              <HistoryMonth filters={filters} today={today} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
