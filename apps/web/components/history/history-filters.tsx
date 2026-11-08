'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeftRight,
  CalendarRange,
  CreditCard,
  Search,
  Shapes,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { DatePicker } from '@finnit/ui/components/ui/date-picker';
import {
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@finnit/ui/components/ui/dropdown-menu';
import { InputWithIcon } from '@finnit/ui/components/ui/input-with-icon';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@finnit/ui/components/ui/popover';
import { cn } from '@finnit/ui/lib/utils';

import { FilterMenu } from '@/components/filters/filter-menu';
import { MonthSwitcher } from '@/components/finance/month-switcher';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  monthLabel,
  monthOf,
  shortDate,
  type DayKey,
} from '@finnit/core/finance/dates';
import {
  TYPE_OPTIONS,
  activeFilterCount,
  hasFilters,
  hasRange,
  historyHref,
  historyQuery,
  monthLinks,
  toggleValue,
  withPeriod,
  type HistoryFilters as Filters,
  type HistoryType,
} from '@finnit/core/history/filters';
import type { Option } from '@finnit/core/history/view';

const ALL = 'all';

/**
 * The history's toolbar, fixed under the header while the list scrolls
 * (exactly where it starts, so it never moves; see useStickyTops): search
 * and "Filtros", which shows or hides a row of dropdowns (accounts and
 * categories with checkboxes, type, dates); the filters in use as
 * removable chips, and the month (‹ Noviembre 2026 ›). Every change
 * updates the URL.
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
  const [open, setOpen] = React.useState(false);
  const links = monthLinks(filters, today);
  const panelId = React.useId();

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

  const clearAction = (onClear: () => void, disabled: boolean) => (
    <button
      type="button"
      onClick={onClear}
      disabled={disabled}
      className="mr-1 rounded-md px-2 py-1 text-xs font-medium text-brand-ink outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"
    >
      {tf('clearSelection')}
    </button>
  );

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
        <div className="relative shrink-0">
          <Button
            variant="outline"
            className={cn('min-h-12', open && 'border-brand/40 bg-brand/5')}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={t('moreFiltersLabel', { count })}
            onClick={() => setOpen((value) => !value)}
          >
            <SlidersHorizontal aria-hidden />
            <span className="hidden sm:inline">{t('moreFilters')}</span>
          </Button>
          {count > 0 ? (
            <span
              aria-hidden
              className="pointer-events-none absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-brand-foreground shadow-sm ring-2 ring-surface"
            >
              {count > 9 ? '9+' : count}
            </span>
          ) : null}
        </div>
      </div>

      {open ? (
        <div
          id={panelId}
          className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] @2xl:flex-wrap @2xl:overflow-visible"
        >
          <FilterMenu
            icon={CreditCard}
            label={tf('accounts')}
            count={filters.accountIds?.length ?? 0}
            action={clearAction(
              () => apply({ ...filters, accountIds: undefined }),
              !filters.accountIds?.length,
            )}
          >
            {accounts.map((account) => (
              <DropdownMenuCheckboxItem
                key={account.value}
                checked={filters.accountIds?.includes(account.value) ?? false}
                onCheckedChange={(on) =>
                  apply({
                    ...filters,
                    accountIds: toggleValue(
                      filters.accountIds,
                      account.value,
                      on,
                    ),
                  })
                }
              >
                <span className="min-w-0 flex-1 truncate">
                  {account.label}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </FilterMenu>

          <FilterMenu
            icon={Shapes}
            label={tf('categories')}
            count={filters.categoryIds?.length ?? 0}
            action={clearAction(
              () => apply({ ...filters, categoryIds: undefined }),
              !filters.categoryIds?.length,
            )}
          >
            {categories.map((category) => (
              <DropdownMenuCheckboxItem
                key={category.value}
                checked={
                  filters.categoryIds?.includes(category.value) ?? false
                }
                onCheckedChange={(on) =>
                  apply({
                    ...filters,
                    categoryIds: toggleValue(
                      filters.categoryIds,
                      category.value,
                      on,
                    ),
                  })
                }
              >
                <span className="min-w-0 flex-1 truncate">
                  {category.label}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </FilterMenu>

          <FilterMenu
            icon={ArrowLeftRight}
            label={tf('type')}
            value={filters.type ? t(`types.${filters.type}`) : null}
          >
            <DropdownMenuRadioGroup
              value={filters.type ?? ALL}
              onValueChange={(v) =>
                apply({
                  ...filters,
                  type: v === ALL ? undefined : (v as HistoryType),
                })
              }
            >
              {TYPE_OPTIONS.map((value) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {t(`types.${value}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </FilterMenu>

          <DatesMenu
            filters={filters}
            today={today}
            value={datesLabel}
            onApply={apply}
          />
        </div>
      ) : null}

      {chips.length > 0 ? (
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
        </div>
      ) : null}

      {links && filters.period !== 'all' ? (
        <div className="flex justify-end">
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
        </div>
      ) : null}
    </div>
  );
}

/**
 * "Fechas": month by month (the default), the whole history, or a range
 * picked with two calendars. A popover, not a menu, so the calendars work.
 */
function DatesMenu({
  filters,
  today,
  value,
  onApply,
}: {
  filters: Filters;
  today: DayKey;
  value: string | null;
  onApply: (next: Filters) => void;
}) {
  const t = useTranslations('history');
  const tf = useTranslations('history.filters');
  const locale = useLocale();
  const mode = hasRange(filters)
    ? 'range'
    : filters.period === 'all'
      ? 'all'
      : 'month';
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'shrink-0 gap-1.5 rounded-full',
            value && 'border-brand/40 bg-brand/5',
          )}
        >
          <CalendarRange aria-hidden />
          <span>{tf('dates')}</span>
          {value ? (
            <span className="font-normal text-on-surface-variant">
              · {value}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 p-4"
      >
        <div
          role="radiogroup"
          aria-label={tf('dates')}
          className="flex gap-1 rounded-full bg-track p-1"
        >
          {(['month', 'all'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={mode === option}
              onClick={() =>
                onApply(
                  withPeriod(
                    filters,
                    option === 'all' ? 'all' : monthOf(today),
                  ),
                )
              }
              className={cn(
                'flex min-h-9 flex-1 items-center justify-center rounded-full px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                mode === option
                  ? 'bg-surface text-on-background shadow-sm'
                  : 'text-on-surface-variant hover:text-on-background',
              )}
            >
              {option === 'all' ? tf('allTime') : tf('month')}
            </button>
          ))}
        </div>
        <p className="px-1 text-xs font-medium text-on-surface-variant">
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
            onChange={(from) => onApply({ ...filters, from })}
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
            onChange={(to) => onApply({ ...filters, to })}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
