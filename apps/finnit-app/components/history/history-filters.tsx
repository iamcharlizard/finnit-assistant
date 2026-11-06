import * as React from 'react';
import { useTranslations } from 'use-intl';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';

import { monthLabel, monthOf, shortDate, type DayKey } from '@finnit/core/finance/dates';
import {
  TYPE_OPTIONS,
  hasFilters,
  hasRange,
  monthLinks,
  moreFiltersCount,
  withPeriod,
  type HistoryFilters as Filters,
  type HistoryType,
} from '@finnit/core/history/filters';
import type { Option } from '@finnit/core/history/view';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { FilterChipGroup } from '@finnit/ui-native/components/finance/filter-chip-group';
import { Button } from '@finnit/ui-native/components/ui/button';
import { DatePicker } from '@finnit/ui-native/components/ui/date-picker';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Input } from '@finnit/ui-native/components/ui/input';
import { Select } from '@finnit/ui-native/components/ui/select';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { MonthSwitcher } from '@/components/finance/month-switcher';
import { useLocale } from '@/lib/i18n/i18n-provider';

const ALL = 'all';

/**
 * The history's toolbar (the web's HistoryFilters): search, "Filtros"
 * (account, category, whole history or a date range), the type chips and
 * the month. Every change updates the route params.
 */
export function HistoryFilters({
  filters,
  accounts,
  categories,
  today,
  aliasName,
  onChange,
}: {
  filters: Filters;
  accounts: Option[];
  categories: Option[];
  today: DayKey;
  aliasName?: string | null;
  onChange: (next: Filters) => void;
}) {
  const t = useTranslations('history');
  const tc = useTranslations('common');
  const { locale } = useLocale();
  const [search, setSearch] = React.useState(filters.search ?? '');
  const [moreOpen, setMoreOpen] = React.useState(false);
  const extra = moreFiltersCount(filters);
  const links = monthLinks(filters, today);

  // Search 400 ms after the last keystroke, like the web.
  React.useEffect(() => {
    const value = search.trim();
    if (value === (filters.search ?? '')) return;
    const timer = setTimeout(() => onChange({ ...filters, search: value || undefined }), 400);
    return () => clearTimeout(timer);
  }, [search, filters, onChange]);

  return (
    <TwView className="gap-3 rounded-3xl border border-glass-border bg-surface-95 p-3">
      <TwView className="flex-row items-center gap-2">
        <TwView className="min-w-0 flex-1">
          <Input
            icon={Search}
            value={search}
            onChangeText={setSearch}
            placeholder={t('searchPlaceholder')}
            accessibilityLabel={t('searchLabel')}
            returnKeyType="search"
            autoCorrect={false}
            className="min-h-12"
          />
        </TwView>
        <TwPressable
          accessibilityRole="button"
          accessibilityLabel={t('moreFiltersLabel', { count: extra })}
          onPress={() => setMoreOpen(true)}
          className="min-h-12 flex-row items-center gap-1 rounded-button border border-outline px-4"
        >
          <Icon icon={SlidersHorizontal} size={18} />
          {extra > 0 ? (
            <TwView className="size-5 items-center justify-center rounded-full bg-brand">
              <Text weight="bold" className="text-[11px] text-brand-foreground">
                {String(extra)}
              </Text>
            </TwView>
          ) : null}
        </TwPressable>
      </TwView>

      {filters.aliasId ? (
        <TwPressable
          accessibilityRole="button"
          accessibilityLabel={t('clearAlias')}
          onPress={() => onChange({ ...filters, aliasId: undefined })}
          className="min-h-9 flex-row items-center gap-1.5 self-start rounded-full bg-primary-15 px-3"
        >
          <Text weight="medium" className="text-sm">
            {t('aliasFilter', { name: aliasName ?? '…' })}
          </Text>
          <Icon icon={X} size={16} />
        </TwPressable>
      ) : null}

      <FilterChipGroup
        items={TYPE_OPTIONS.map((value) => ({ value, label: t(`types.${value}`) }))}
        activeValue={filters.type ?? ALL}
        onSelect={(v) => onChange({ ...filters, type: v === ALL ? undefined : (v as HistoryType) })}
        accessibilityLabel={t('filterByType')}
      />

      <TwView className="items-center">
        {links && filters.period !== 'all' ? (
          <MonthSwitcher
            compact
            label={monthLabel(filters.period, locale)}
            onPrevious={() => onChange(withPeriod(filters, links.prev))}
            onNext={links.next ? () => onChange(withPeriod(filters, links.next!)) : null}
          />
        ) : (
          <TwPressable
            accessibilityRole="button"
            accessibilityLabel={t('backToMonth')}
            onPress={() => onChange(withPeriod(filters, monthOf(today)))}
            className="min-h-11 flex-row items-center gap-1.5 rounded-full bg-track px-4"
          >
            <Text weight="medium" className="text-sm">
              {hasRange(filters)
                ? t('rangeLabel', {
                    from: filters.from ? shortDate(filters.from, locale) : '…',
                    to: filters.to ? shortDate(filters.to, locale) : '…',
                  })
                : t('allTime')}
            </Text>
            <Icon icon={X} size={16} />
          </TwPressable>
        )}
      </TwView>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title={t('moreFilters')} closeLabel={tc('close')} className="gap-3">
        <Select
          label={t('account')}
          value={filters.accountId ?? ALL}
          options={[{ value: ALL, label: t('allAccounts') }, ...accounts]}
          onValueChange={(v) => onChange({ ...filters, accountId: v === ALL ? undefined : v })}
          closeLabel={tc('close')}
        />
        <Select
          label={t('category')}
          value={filters.categoryId ?? ALL}
          options={[{ value: ALL, label: t('allCategories') }, ...categories]}
          onValueChange={(v) => onChange({ ...filters, categoryId: v === ALL ? undefined : v })}
          searchable
          closeLabel={tc('close')}
        />
        <Text weight="medium" className="px-1 pt-1 text-xs text-on-surface-variant">
          {t('range')}
        </Text>
        <TwView className="flex-row gap-2">
          <TwView className="flex-1">
            <DatePicker
              locale={locale}
              placeholder={t('from')}
              value={filters.from}
              max={filters.to ?? today}
              clearable
              clearLabel={t('clearDate')}
              onChange={(from) => onChange({ ...filters, from })}
              closeLabel={tc('close')}
            />
          </TwView>
          <TwView className="flex-1">
            <DatePicker
              locale={locale}
              placeholder={t('to')}
              value={filters.to}
              min={filters.from}
              max={today}
              clearable
              clearLabel={t('clearDate')}
              onChange={(to) => onChange({ ...filters, to })}
              closeLabel={tc('close')}
            />
          </TwView>
        </TwView>
        {filters.period !== 'all' && !hasRange(filters) ? (
          <Button variant="ghost" label={t('allTime')} className="justify-start" onPress={() => onChange(withPeriod(filters, 'all'))} />
        ) : null}
        {hasFilters(filters) ? (
          <Button
            variant="ghost"
            icon={X}
            label={t('clearFilters')}
            className="justify-start"
            onPress={() => {
              setSearch('');
              onChange({ period: filters.period });
              setMoreOpen(false);
            }}
          />
        ) : null}
      </Sheet>
    </TwView>
  );
}
