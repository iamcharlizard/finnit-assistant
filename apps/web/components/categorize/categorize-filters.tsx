'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { FilterChipGroup } from '@finnit/ui/components/finance/filter-chip-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@finnit/ui/components/ui/select';

import { MonthSwitcher } from '@/components/finance/month-switcher';
import {
  SHOW_OPTIONS,
  categorizeHref,
  periodLinks,
  type CategorizeFilters as Filters,
  type CategorizeShow,
} from '@/lib/categorize/filters';
import { monthLabel, monthOf, type DayKey } from '@/lib/finance/dates';
import type { EntryAccount } from '@/lib/new-entry/graphql';
import { accountOptions } from '@/lib/new-entry/options';

const ALL = 'all';

/** Account, what to show and the period; every change updates the URL. */
export function CategorizeFilters({
  filters,
  accounts,
  today,
}: {
  filters: Filters;
  accounts: EntryAccount[];
  today: DayKey;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('categorize.filters');
  const accountItems = React.useMemo(
    () => accountOptions(accounts),
    [accounts],
  );
  const showItems = React.useMemo(
    () => SHOW_OPTIONS.map((value) => ({ value, label: t(`shows.${value}`) })),
    [t],
  );
  const periodItems = React.useMemo(
    () => [
      { value: 'month', label: t('byMonth') },
      { value: ALL, label: t('allTime') },
    ],
    [t],
  );
  const links = periodLinks(filters, today);

  const apply = (next: Filters) =>
    router.replace(categorizeHref(next, today), { scroll: false });

  return (
    <div className="mb-6 flex flex-col gap-3">
      <FilterChipGroup
        items={showItems}
        activeValue={filters.show}
        onSelect={(v) => apply({ ...filters, show: v as CategorizeShow })}
        aria-label={t('show')}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          value={filters.accountId ?? ALL}
          onValueChange={(v) =>
            apply({ ...filters, accountId: v === ALL ? undefined : v })
          }
        >
          <SelectTrigger aria-label={t('account')} className="min-h-12 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allAccounts')}</SelectItem>
            {accountItems.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FilterChipGroup
          items={periodItems}
          activeValue={filters.period === 'all' ? ALL : 'month'}
          onSelect={(v) =>
            apply({
              ...filters,
              period: v === ALL ? 'all' : monthOf(today),
            })
          }
          aria-label={t('period')}
          className="self-center"
        />
      </div>

      {links && filters.period !== 'all' ? (
        <div className="flex justify-center">
          <MonthSwitcher
            as="h2"
            label={monthLabel(filters.period, locale)}
            prevHref={links.prevHref}
            nextHref={links.nextHref}
          />
        </div>
      ) : null}
    </div>
  );
}
