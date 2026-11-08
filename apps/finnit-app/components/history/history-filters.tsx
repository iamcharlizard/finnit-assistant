import * as React from 'react';
import { ScrollView } from 'react-native';
import { useTranslations } from 'use-intl';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';

import { monthLabel, monthOf, shortDate, type DayKey, type MonthRef } from '@finnit/core/finance/dates';
import {
  TYPE_OPTIONS,
  activeFilterCount,
  hasFilters,
  hasRange,
  monthLinks,
  toggleValue,
  withPeriod,
  type HistoryFilters as Filters,
  type HistoryType,
} from '@finnit/core/history/filters';
import type { Option } from '@finnit/core/history/view';
import { rankOptions } from '@finnit/core/text/option-search';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Checkbox } from '@finnit/ui-native/components/ui/checkbox';
import { DatePicker } from '@finnit/ui-native/components/ui/date-picker';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Input } from '@finnit/ui-native/components/ui/input';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { ChoiceRow } from '@/components/filters/choice-row';
import { FilterSection } from '@/components/filters/filter-section';
import { MonthSwitcher } from '@/components/finance/month-switcher';
import { useLocale } from '@/lib/i18n/i18n-provider';

const ALL = 'all';

type Section = 'accounts' | 'categories' | 'type' | 'dates';

/** Categories shown before "Ver todas". */
const FIRST_CATEGORIES = 8;

/**
 * The history's toolbar (the web's HistoryFilters): search and "Filtros",
 * with the active count above it, which opens one sheet with every filter
 * in collapsible sections (accounts and categories with checkboxes,
 * type, dates); the filters in use as removable chips with the month at
 * the end of the same row. Every change updates the route params.
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
  const tf = useTranslations('history.filters');
  const tc = useTranslations('common');
  const { locale } = useLocale();
  const [search, setSearch] = React.useState(filters.search ?? '');
  const [open, setOpen] = React.useState(false);
  const [sections, setSections] = React.useState<ReadonlySet<Section>>(() => new Set(['accounts']));
  const [categoryQuery, setCategoryQuery] = React.useState('');
  const [allCategories, setAllCategories] = React.useState(false);
  const count = activeFilterCount(filters);
  const links = monthLinks(filters, today);

  // Search 400 ms after the last keystroke, like the web.
  React.useEffect(() => {
    const value = search.trim();
    if (value === (filters.search ?? '')) return;
    const timer = setTimeout(() => onChange({ ...filters, search: value || undefined }), 400);
    return () => clearTimeout(timer);
  }, [search, filters, onChange]);

  const toggleSection = (key: Section) =>
    setSections((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const labelOf = (options: Option[], id: string) => options.find((o) => o.value === id)?.label ?? id;
  const datesLabel = hasRange(filters)
    ? t('rangeLabel', {
        from: filters.from ? shortDate(filters.from, locale) : '…',
        to: filters.to ? shortDate(filters.to, locale) : '…',
      })
    : filters.period === 'all'
      ? t('allTime')
      : null;

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...(filters.type ? [{ key: 'type', label: t(`types.${filters.type}`), remove: () => onChange({ ...filters, type: undefined }) }] : []),
    ...(filters.accountIds ?? []).map((id) => ({
      key: `account:${id}`,
      label: labelOf(accounts, id),
      remove: () => onChange({ ...filters, accountIds: toggleValue(filters.accountIds, id, false) }),
    })),
    ...(filters.categoryIds ?? []).map((id) => ({
      key: `category:${id}`,
      label: labelOf(categories, id),
      remove: () => onChange({ ...filters, categoryIds: toggleValue(filters.categoryIds, id, false) }),
    })),
    ...(datesLabel ? [{ key: 'dates', label: datesLabel, remove: () => onChange(withPeriod(filters, monthOf(today))) }] : []),
    ...(filters.aliasId
      ? [{ key: 'alias', label: t('aliasFilter', { name: aliasName ?? '…' }), remove: () => onChange({ ...filters, aliasId: undefined }) }]
      : []),
  ];

  const matching = categoryQuery.trim() ? rankOptions(categories, categoryQuery) : categories;
  const shownCategories = allCategories || categoryQuery.trim() ? matching : matching.slice(0, FIRST_CATEGORIES);
  const dateMode = hasRange(filters) ? 'range' : filters.period === 'all' ? 'all' : 'month';
  const showMonth = Boolean(links) && filters.period !== 'all';
  const clearAll = () => {
    setSearch('');
    onChange({ period: filters.period });
  };

  const clearLink = (onClear: () => void, disabled: boolean) => (
    <TwView className="flex-row">
      <Button variant="ghost" size="sm" label={tf('clearSelection')} disabled={disabled} onPress={onClear} />
    </TwView>
  );

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
        <TwView>
          <TwPressable
            accessibilityRole="button"
            accessibilityLabel={t('moreFiltersLabel', { count })}
            onPress={() => setOpen(true)}
            className="min-h-12 flex-row items-center rounded-button border border-outline px-4"
          >
            <Icon icon={SlidersHorizontal} size={18} />
          </TwPressable>
          {count > 0 ? (
            <TwView
              pointerEvents="none"
              className="absolute -right-1.5 -top-1.5 size-5 items-center justify-center rounded-full border-2 border-surface bg-brand"
            >
              <Text weight="bold" className="text-[10px] text-brand-foreground">
                {count > 9 ? '9+' : String(count)}
              </Text>
            </TwView>
          ) : null}
        </TwView>
      </TwView>

      {/* The filters in use, and the month at the end of the same row. */}
      {chips.length > 0 || showMonth ? (
        <TwView className="flex-row flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <TwPressable
              key={chip.key}
              accessibilityRole="button"
              accessibilityLabel={tf('remove', { name: chip.label })}
              onPress={chip.remove}
              className="max-w-full flex-row items-center gap-1 rounded-full border border-brand-30 bg-brand-10 py-1 pr-2 pl-3"
            >
              <Text weight="medium" numberOfLines={1} className="shrink text-xs text-brand-ink">
                {chip.label}
              </Text>
              <Icon icon={X} size={14} color="--brand-ink" />
            </TwPressable>
          ))}
          {showMonth && links ? (
            <TwView className="ml-auto">
              <MonthSwitcher
                compact
                label={monthLabel(filters.period as MonthRef, locale)}
                onPrevious={() => onChange(withPeriod(filters, links.prev))}
                onNext={links.next ? () => onChange(withPeriod(filters, links.next!)) : null}
              />
            </TwView>
          ) : null}
        </TwView>
      ) : null}

      {open ? (
        <Sheet
          open
          onOpenChange={(value) => {
            if (!value) {
              setOpen(false);
              setCategoryQuery('');
            }
          }}
          title={t('moreFilters')}
          closeLabel={tc('close')}
        >
          <TwView className="flex-row justify-end">
            <Button variant="ghost" size="sm" label={tf('clearAll')} disabled={!hasFilters(filters)} onPress={clearAll} />
          </TwView>
          <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
            <FilterSection
              title={tf('accounts')}
              count={filters.accountIds?.length ?? 0}
              open={sections.has('accounts')}
              onToggle={() => toggleSection('accounts')}
            >
              {clearLink(() => onChange({ ...filters, accountIds: undefined }), !filters.accountIds?.length)}
              {accounts.map((account) => (
                <TwView key={account.value} className="px-1 py-2">
                  <Checkbox
                    label={account.label}
                    checked={filters.accountIds?.includes(account.value) ?? false}
                    onCheckedChange={(on) => onChange({ ...filters, accountIds: toggleValue(filters.accountIds, account.value, on) })}
                  />
                </TwView>
              ))}
            </FilterSection>

            <FilterSection
              title={tf('categories')}
              count={filters.categoryIds?.length ?? 0}
              open={sections.has('categories')}
              onToggle={() => toggleSection('categories')}
            >
              <Input
                icon={Search}
                value={categoryQuery}
                onChangeText={setCategoryQuery}
                placeholder={t('categorySearch')}
                accessibilityLabel={t('categorySearch')}
                autoCorrect={false}
              />
              {clearLink(() => onChange({ ...filters, categoryIds: undefined }), !filters.categoryIds?.length)}
              {shownCategories.map((category) => (
                <TwView key={category.value} className="px-1 py-2">
                  <Checkbox
                    label={category.label}
                    checked={filters.categoryIds?.includes(category.value) ?? false}
                    onCheckedChange={(on) => onChange({ ...filters, categoryIds: toggleValue(filters.categoryIds, category.value, on) })}
                  />
                </TwView>
              ))}
              {!categoryQuery.trim() && matching.length > FIRST_CATEGORIES ? (
                <TwView className="flex-row">
                  <Button
                    variant="ghost"
                    size="sm"
                    label={allCategories ? tf('showFewer') : tf('showAll', { count: matching.length })}
                    onPress={() => setAllCategories((value) => !value)}
                  />
                </TwView>
              ) : null}
            </FilterSection>

            <FilterSection
              title={tf('type')}
              count={filters.type ? 1 : 0}
              open={sections.has('type')}
              onToggle={() => toggleSection('type')}
            >
              {TYPE_OPTIONS.map((value) => (
                <ChoiceRow
                  key={value}
                  label={t(`types.${value}`)}
                  selected={(filters.type ?? ALL) === value}
                  onPress={() => onChange({ ...filters, type: value === ALL ? undefined : (value as HistoryType) })}
                />
              ))}
            </FilterSection>

            <FilterSection
              title={tf('dates')}
              count={dateMode === 'month' ? 0 : 1}
              open={sections.has('dates')}
              onToggle={() => toggleSection('dates')}
            >
              <TwView accessibilityRole="radiogroup" className="flex-row gap-1 rounded-full bg-track p-1">
                {(['month', 'all'] as const).map((option) => (
                  <TwPressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: dateMode === option }}
                    onPress={() => onChange(withPeriod(filters, option === 'all' ? 'all' : monthOf(today)))}
                    className={cn('min-h-10 flex-1 items-center justify-center rounded-full px-3', dateMode === option ? 'bg-surface' : '')}
                  >
                    <Text
                      weight="medium"
                      className={cn('text-sm', dateMode === option ? 'text-on-background' : 'text-on-surface-variant')}
                    >
                      {option === 'all' ? tf('allTime') : tf('month')}
                    </Text>
                  </TwPressable>
                ))}
              </TwView>
              <Text weight="medium" className="px-1 pt-2 text-xs text-on-surface-variant">
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
            </FilterSection>
          </ScrollView>
          <Button variant="secondary" label={tc('done')} onPress={() => setOpen(false)} />
        </Sheet>
      ) : null}
    </TwView>
  );
}
