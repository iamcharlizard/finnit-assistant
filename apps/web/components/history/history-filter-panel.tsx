'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search } from 'lucide-react';

import { Checkbox } from '@finnit/ui/components/ui/checkbox';
import { DatePicker } from '@finnit/ui/components/ui/date-picker';
import { InputWithIcon } from '@finnit/ui/components/ui/input-with-icon';
import { cn } from '@finnit/ui/lib/utils';

import { FilterSection } from '@/components/filters/filter-section';
import { monthOf, type DayKey } from '@finnit/core/finance/dates';
import {
  TYPE_OPTIONS,
  hasRange,
  toggleValue,
  withPeriod,
  type HistoryFilters as Filters,
  type HistoryType,
} from '@finnit/core/history/filters';
import type { Option } from '@finnit/core/history/view';
import { rankOptions } from '@finnit/core/text/option-search';

type SectionKey = 'accounts' | 'categories' | 'type' | 'dates';

/** Categories shown before "Ver todas". */
const FIRST_CATEGORIES = 8;

/**
 * Everything the "Filtros" dropdown holds, in collapsible sections:
 * accounts and categories with checkboxes (each with "Deseleccionar
 * todas"; categories with a search), the type, and the dates (by month,
 * the whole history or a range). Every change applies at once.
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
  const [open, setOpen] = React.useState<ReadonlySet<SectionKey>>(
    () => new Set(['accounts']),
  );
  const [query, setQuery] = React.useState('');
  const [allCategories, setAllCategories] = React.useState(false);

  const toggleSection = (key: SectionKey) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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

  const clearLink = (onClear: () => void, disabled: boolean) => (
    <button
      type="button"
      onClick={onClear}
      disabled={disabled}
      className="self-start rounded-md px-1 py-1 text-xs font-medium text-brand-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"
    >
      {tf('clearSelection')}
    </button>
  );

  return (
    <div className="flex flex-col">
      <FilterSection
        title={tf('accounts')}
        count={filters.accountIds?.length ?? 0}
        open={open.has('accounts')}
        onToggle={() => toggleSection('accounts')}
      >
        {clearLink(
          () => onApply({ ...filters, accountIds: undefined }),
          !filters.accountIds?.length,
        )}
        {accounts.map((account) => (
          <CheckRow
            key={account.value}
            label={account.label}
            checked={filters.accountIds?.includes(account.value) ?? false}
            onChange={(on) =>
              onApply({
                ...filters,
                accountIds: toggleValue(filters.accountIds, account.value, on),
              })
            }
          />
        ))}
      </FilterSection>

      <FilterSection
        title={tf('categories')}
        count={filters.categoryIds?.length ?? 0}
        open={open.has('categories')}
        onToggle={() => toggleSection('categories')}
      >
        <InputWithIcon
          iconLeft={Search}
          type="search"
          placeholder={t('categorySearch')}
          aria-label={t('categorySearch')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-1 min-h-10"
        />
        {clearLink(
          () => onApply({ ...filters, categoryIds: undefined }),
          !filters.categoryIds?.length,
        )}
        {shownCategories.map((category) => (
          <CheckRow
            key={category.value}
            label={category.label}
            checked={filters.categoryIds?.includes(category.value) ?? false}
            onChange={(on) =>
              onApply({
                ...filters,
                categoryIds: toggleValue(
                  filters.categoryIds,
                  category.value,
                  on,
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
      </FilterSection>

      <FilterSection
        title={tf('type')}
        count={filters.type ? 1 : 0}
        open={open.has('type')}
        onToggle={() => toggleSection('type')}
      >
        <div
          role="radiogroup"
          aria-label={tf('type')}
          className="flex flex-col"
        >
          {TYPE_OPTIONS.map((value) => {
            const selected = (filters.type ?? 'all') === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() =>
                  onApply({
                    ...filters,
                    type: value === 'all' ? undefined : (value as HistoryType),
                  })
                }
                className="flex min-h-10 items-center gap-3 rounded-lg px-1 text-left text-sm text-on-background outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px]',
                    selected ? 'border-accent-neon' : 'border-input',
                  )}
                >
                  {selected ? (
                    <span className="size-2.5 rounded-full bg-accent-neon" />
                  ) : null}
                </span>
                {t(`types.${value}`)}
              </button>
            );
          })}
        </div>
      </FilterSection>

      <FilterSection
        title={tf('dates')}
        count={dateMode === 'month' ? 0 : 1}
        open={open.has('dates')}
        onToggle={() => toggleSection('dates')}
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
      </FilterSection>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = React.useId();
  return (
    <div className="flex min-h-10 items-center gap-3 rounded-lg px-1 hover:bg-accent">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
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
