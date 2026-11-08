'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search } from 'lucide-react';

import { Checkbox } from '@finnit/ui/components/ui/checkbox';
import { DatePicker } from '@finnit/ui/components/ui/date-picker';
import { InputWithIcon } from '@finnit/ui/components/ui/input-with-icon';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@finnit/ui/components/ui/tabs';
import { cn } from '@finnit/ui/lib/utils';

import { monthOf, type DayKey } from '@finnit/core/finance/dates';
import {
  HISTORY_TYPES,
  categoryCheck,
  hasRange,
  isSelected,
  selectCategory,
  selectValues,
  withPeriod,
  type HistoryFilters as Filters,
} from '@finnit/core/history/filters';
import type { Option } from '@finnit/core/history/view';
import { rankOptions } from '@finnit/core/text/option-search';

type Tab = 'accounts' | 'categories' | 'type' | 'dates';

/** Categories shown before "Ver todas". */
const FIRST_CATEGORIES = 8;

/**
 * Everything the "Filtros" dropdown holds, one tab per group so none ends
 * up far below the others: accounts, categories (with a search; a parent
 * checks its subcategories) and types as checkboxes, every box checked
 * while the group doesn't narrow the list; and the dates (by month, the
 * whole history or a range). Every change applies at once.
 */
export function HistoryFilterPanel({
  filters,
  accounts,
  categories,
  today,
  onApply,
}: {
  filters: Filters;
  accounts: Option[];
  categories: Option[];
  today: DayKey;
  onApply: (next: Filters) => void;
}) {
  const t = useTranslations('history');
  const tf = useTranslations('history.filters');
  const locale = useLocale();
  const [tab, setTab] = React.useState<Tab>('accounts');
  const [query, setQuery] = React.useState('');
  const [allCategories, setAllCategories] = React.useState(false);

  const accountIds = accounts.map((a) => a.value);
  const matching = query.trim() ? rankOptions(categories, query) : categories;
  const shownCategories =
    allCategories || query.trim()
      ? matching
      : matching.slice(0, FIRST_CATEGORIES);
  const dateMode = hasRange(filters)
    ? 'range'
    : filters.period === 'all'
      ? 'all'
      : 'month';

  const narrowed: Record<Tab, boolean> = {
    accounts: Boolean(filters.accountIds),
    categories: Boolean(filters.categoryIds),
    type: Boolean(filters.types),
    dates: dateMode !== 'month',
  };
  const tabs: Tab[] = ['accounts', 'categories', 'type', 'dates'];

  /** "Seleccionar todas" when some box is unchecked, else "Deseleccionar todas". */
  const allToggle = (
    list: ReadonlyArray<string> | undefined,
    onAll: () => void,
    onNone: () => void,
  ) => (
    <button
      type="button"
      onClick={list ? onAll : onNone}
      className="self-start rounded-md px-1 py-1 text-xs font-medium text-brand-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {list ? tf('selectAll') : tf('clearSelection')}
    </button>
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as Tab)}
      className="min-h-0 flex-1 gap-2"
    >
      <TabsList className="mx-3 w-auto shrink-0">
        {tabs.map((key) => (
          <TabsTrigger key={key} value={key} className="flex-1 gap-1 px-2">
            {tf(key)}
            {narrowed[key] ? (
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full bg-brand"
              />
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* A steady height, so switching tabs doesn't resize the dropdown. */}
      <div className="h-[min(22rem,calc(var(--radix-popover-content-available-height)-8rem))] min-h-40 overflow-y-auto px-3 pb-2">
        <TabsContent value="accounts" className="flex flex-col gap-0.5">
          {allToggle(
            filters.accountIds,
            () => onApply({ ...filters, accountIds: undefined }),
            () => onApply({ ...filters, accountIds: [] }),
          )}
          {accounts.map((account) => (
            <CheckRow
              key={account.value}
              label={account.label}
              checked={isSelected(filters.accountIds, account.value)}
              onChange={(on) =>
                onApply({
                  ...filters,
                  accountIds: selectValues(
                    filters.accountIds,
                    [account.value],
                    on,
                    accountIds,
                  ),
                })
              }
            />
          ))}
        </TabsContent>

        <TabsContent value="categories" className="flex flex-col gap-0.5">
          <InputWithIcon
            iconLeft={Search}
            type="search"
            placeholder={t('categorySearch')}
            aria-label={t('categorySearch')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-1 min-h-10"
          />
          {allToggle(
            filters.categoryIds,
            () => onApply({ ...filters, categoryIds: undefined }),
            () => onApply({ ...filters, categoryIds: [] }),
          )}
          {shownCategories.map((category) => (
            <CheckRow
              key={category.value}
              label={category.label}
              checked={categoryCheck(filters.categoryIds, category, categories)}
              onChange={(on) =>
                onApply({
                  ...filters,
                  categoryIds: selectCategory(
                    filters.categoryIds,
                    category,
                    on,
                    categories,
                  ),
                })
              }
            />
          ))}
          {!query.trim() && matching.length > FIRST_CATEGORIES ? (
            <button
              type="button"
              onClick={() => setAllCategories((value) => !value)}
              className="self-start rounded-md px-1 py-1 text-sm font-medium text-brand-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {allCategories
                ? tf('showFewer')
                : tf('showAll', { count: matching.length })}
            </button>
          ) : null}
        </TabsContent>

        <TabsContent value="type" className="flex flex-col gap-0.5">
          {HISTORY_TYPES.map((value) => (
            <CheckRow
              key={value}
              label={t(`types.${value}`)}
              checked={isSelected(filters.types, value)}
              onChange={(on) =>
                onApply({
                  ...filters,
                  types: selectValues(
                    filters.types,
                    [value],
                    on,
                    HISTORY_TYPES,
                  ),
                })
              }
            />
          ))}
        </TabsContent>

        <TabsContent value="dates" className="flex flex-col gap-1 pt-1">
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
                aria-checked={dateMode === option}
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
                  dateMode === option
                    ? 'bg-surface text-on-background shadow-sm'
                    : 'text-on-surface-variant hover:text-on-background',
                )}
              >
                {option === 'all' ? tf('allTime') : tf('month')}
              </button>
            ))}
          </div>
          <p className="px-1 pt-2 text-xs font-medium text-on-surface-variant">
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
        </TabsContent>
      </div>
    </Tabs>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean | 'indeterminate';
  onChange: (on: boolean) => void;
}) {
  const id = React.useId();
  return (
    <div className="flex min-h-10 items-center gap-3 rounded-lg px-1 hover:bg-accent">
      <Checkbox
        id={id}
        checked={checked}
        // A mixed parent checks its whole family.
        onCheckedChange={() => onChange(checked !== true)}
      />
      <label
        htmlFor={id}
        className="min-w-0 flex-1 cursor-pointer truncate py-2 text-sm text-on-background"
      >
        {label}
      </label>
    </div>
  );
}
