import * as React from 'react';
import { ScrollView } from 'react-native';
import { useTranslations } from 'use-intl';
import { Search, SlidersHorizontal, Tags, X } from 'lucide-react-native';

import {
  monthLabel,
  monthOf,
  shortDate,
  type DayKey,
  type MonthRef,
} from '@finnit/core/finance/dates';
import {
  HISTORY_TYPES,
  activeFilterCount,
  categoryCheck,
  hasFilters,
  hasRange,
  isSelected,
  monthLinks,
  selectCategory,
  selectValues,
  withPeriod,
  type HistoryFilters as Filters,
} from '@finnit/core/history/filters';
import { selectionLabel, type Option } from '@finnit/core/history/view';
import { rankOptions } from '@finnit/core/text/option-search';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Checkbox } from '@finnit/ui-native/components/ui/checkbox';
import { DatePicker } from '@finnit/ui-native/components/ui/date-picker';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Input } from '@finnit/ui-native/components/ui/input';
import { Segmented } from '@finnit/ui-native/components/ui/segmented';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { MonthSwitcher } from '@/components/finance/month-switcher';
import { useLocale, useLocalizer } from '@/lib/i18n/i18n-provider';

type Tab = 'accounts' | 'categories' | 'type' | 'dates';
const TABS: Tab[] = ['accounts', 'categories', 'type', 'dates'];

/** Categories shown before "Ver todas". */
const FIRST_CATEGORIES = 8;

/**
 * The history's toolbar (the web's HistoryFilters): search and "Filtros",
 * with the active count above it, which opens one sheet with every filter
 * in tabs (accounts, categories and types as checkboxes, all checked while
 * the group doesn't narrow the list; dates); one removable chip per group
 * in use, with the month at the end of the same row. Every change updates
 * the route params.
 */
export function HistoryFilters({
  filters,
  accounts,
  categories,
  today,
  aliasName,
  reviewCount,
  onChange,
}: {
  filters: Filters;
  accounts: Option[];
  categories: Option[];
  today: DayKey;
  aliasName?: string | null;
  /** How many "Por clasificar" has with the other filters. */
  reviewCount: number;
  onChange: (next: Filters) => void;
}) {
  const t = useTranslations('history');
  const tf = useTranslations('history.filters');
  const tc = useTranslations('common');
  const { locale } = useLocale();
  const [search, setSearch] = React.useState(filters.search ?? '');
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>('accounts');
  const { t: tr } = useLocalizer();
  const [categoryQuery, setCategoryQuery] = React.useState('');
  const [allCategories, setAllCategories] = React.useState(false);
  const count = activeFilterCount(filters);
  const links = monthLinks(filters, today);

  // Search 400 ms after the last keystroke, like the web.
  React.useEffect(() => {
    const value = search.trim();
    if (value === (filters.search ?? '')) return;
    const timer = setTimeout(
      () => onChange({ ...filters, search: value || undefined }),
      400,
    );
    return () => clearTimeout(timer);
  }, [search, filters, onChange]);

  const typeOptions = HISTORY_TYPES.map((value) => ({
    value,
    label: t(`types.${value}`),
  }));
  const accountIds = accounts.map((a) => a.value);
  const datesLabel = hasRange(filters)
    ? t('rangeLabel', {
        from: filters.from ? shortDate(filters.from, locale) : '…',
        to: filters.to ? shortDate(filters.to, locale) : '…',
      })
    : filters.period === 'all'
      ? t('allTime')
      : null;

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...(filters.types
      ? [
          {
            key: 'type',
            label: selectionLabel(tf('type'), filters.types, typeOptions, tr),
            remove: () => onChange({ ...filters, types: undefined }),
          },
        ]
      : []),
    ...(filters.accountIds
      ? [
          {
            key: 'accounts',
            label: selectionLabel(
              tf('accounts'),
              filters.accountIds,
              accounts,
              tr,
            ),
            remove: () => onChange({ ...filters, accountIds: undefined }),
          },
        ]
      : []),
    ...(filters.categoryIds
      ? [
          {
            key: 'categories',
            label: selectionLabel(
              tf('categories'),
              filters.categoryIds,
              categories,
              tr,
            ),
            remove: () => onChange({ ...filters, categoryIds: undefined }),
          },
        ]
      : []),
    ...(datesLabel
      ? [
          {
            key: 'dates',
            label: datesLabel,
            remove: () => onChange(withPeriod(filters, monthOf(today))),
          },
        ]
      : []),
    ...(filters.aliasId
      ? [
          {
            key: 'alias',
            label: t('aliasFilter', { name: aliasName ?? '…' }),
            remove: () => onChange({ ...filters, aliasId: undefined }),
          },
        ]
      : []),
  ];

  const matching = categoryQuery.trim()
    ? rankOptions(categories, categoryQuery)
    : categories;
  const shownCategories =
    allCategories || categoryQuery.trim()
      ? matching
      : matching.slice(0, FIRST_CATEGORIES);
  const dateMode = hasRange(filters)
    ? 'range'
    : filters.period === 'all'
      ? 'all'
      : 'month';
  const showMonth = Boolean(links) && filters.period !== 'all';
  const clearAll = () => {
    setSearch('');
    onChange({ period: filters.period });
  };

  const narrowed: Record<Tab, boolean> = {
    accounts: Boolean(filters.accountIds),
    categories: Boolean(filters.categoryIds),
    type: Boolean(filters.types),
    dates: dateMode !== 'month',
  };

  /** "Seleccionar todas" when some box is unchecked, else "Deseleccionar todas". */
  const allToggle = (
    list: readonly string[] | undefined,
    onAll: () => void,
    onNone: () => void,
  ) => (
    <TwView className="flex-row">
      <Button
        variant="ghost"
        size="sm"
        label={list ? tf('selectAll') : tf('clearSelection')}
        onPress={list ? onAll : onNone}
      />
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
        <TwPressable
          accessibilityRole="button"
          accessibilityState={{ selected: Boolean(filters.review) }}
          accessibilityLabel={t('review.label', { count: reviewCount })}
          onPress={() =>
            onChange({ ...filters, review: filters.review ? undefined : true })
          }
          className={cn(
            'min-h-12 flex-row items-center gap-1.5 rounded-button border px-3',
            filters.review ? 'border-brand-40 bg-brand-10' : 'border-outline',
          )}
        >
          <Icon
            icon={Tags}
            size={18}
            color={filters.review ? '--brand-ink' : undefined}
          />
          <TwView
            className={cn(
              'rounded-full px-1.5',
              reviewCount > 0 ? 'bg-brand' : 'bg-muted',
            )}
          >
            <Text
              weight="bold"
              className={cn(
                'text-[11px]',
                reviewCount > 0
                  ? 'text-brand-foreground'
                  : 'text-on-surface-variant',
              )}
            >
              {reviewCount > 999 ? '999+' : String(reviewCount)}
            </Text>
          </TwView>
        </TwPressable>
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
              <Text
                weight="medium"
                numberOfLines={1}
                className="shrink text-xs text-brand-ink"
              >
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
                onNext={
                  links.next
                    ? () => onChange(withPeriod(filters, links.next!))
                    : null
                }
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
            <Button
              variant="ghost"
              size="sm"
              label={tf('clearAll')}
              disabled={!hasFilters(filters)}
              onPress={clearAll}
            />
          </TwView>
          <Segmented
            options={TABS.map((key) => ({
              value: key,
              label: narrowed[key] ? `${tf(key)} •` : tf(key),
            }))}
            value={tab}
            onValueChange={setTab}
            accessibilityLabel={t('moreFilters')}
          />
          {/* A steady height, so switching tabs doesn't resize the sheet. */}
          <ScrollView
            style={{ height: 380 }}
            keyboardShouldPersistTaps="handled"
          >
            {tab === 'accounts' ? (
              <TwView className="gap-0.5">
                {allToggle(
                  filters.accountIds,
                  () => onChange({ ...filters, accountIds: undefined }),
                  () => onChange({ ...filters, accountIds: [] }),
                )}
                {accounts.map((account) => (
                  <TwView key={account.value} className="px-1 py-1">
                    <Checkbox
                      label={account.label}
                      checked={isSelected(filters.accountIds, account.value)}
                      onCheckedChange={(on) =>
                        onChange({
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
                  </TwView>
                ))}
              </TwView>
            ) : null}

            {tab === 'categories' ? (
              <TwView className="gap-0.5">
                <Input
                  icon={Search}
                  value={categoryQuery}
                  onChangeText={setCategoryQuery}
                  placeholder={t('categorySearch')}
                  accessibilityLabel={t('categorySearch')}
                  autoCorrect={false}
                />
                {allToggle(
                  filters.categoryIds,
                  () => onChange({ ...filters, categoryIds: undefined }),
                  () => onChange({ ...filters, categoryIds: [] }),
                )}
                {shownCategories.map((category) => (
                  <TwView key={category.value} className="px-1 py-1">
                    <Checkbox
                      label={category.label}
                      checked={categoryCheck(
                        filters.categoryIds,
                        category,
                        categories,
                      )}
                      onCheckedChange={(on) =>
                        onChange({
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
                  </TwView>
                ))}
                {!categoryQuery.trim() && matching.length > FIRST_CATEGORIES ? (
                  <TwView className="flex-row">
                    <Button
                      variant="ghost"
                      size="sm"
                      label={
                        allCategories
                          ? tf('showFewer')
                          : tf('showAll', { count: matching.length })
                      }
                      onPress={() => setAllCategories((value) => !value)}
                    />
                  </TwView>
                ) : null}
              </TwView>
            ) : null}

            {tab === 'type' ? (
              <TwView className="gap-0.5 pt-2">
                {typeOptions.map((option) => (
                  <TwView key={option.value} className="px-1 py-1">
                    <Checkbox
                      label={option.label}
                      checked={isSelected(filters.types, option.value)}
                      onCheckedChange={(on) =>
                        onChange({
                          ...filters,
                          types: selectValues(
                            filters.types,
                            [option.value],
                            on,
                            HISTORY_TYPES,
                          ),
                        })
                      }
                    />
                  </TwView>
                ))}
              </TwView>
            ) : null}

            {tab === 'dates' ? (
              <TwView className="gap-1 pt-2">
                <TwView
                  accessibilityRole="radiogroup"
                  className="flex-row gap-1 rounded-full bg-track p-1"
                >
                  {(['month', 'all'] as const).map((option) => (
                    <TwPressable
                      key={option}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: dateMode === option }}
                      onPress={() =>
                        onChange(
                          withPeriod(
                            filters,
                            option === 'all' ? 'all' : monthOf(today),
                          ),
                        )
                      }
                      className={cn(
                        'min-h-10 flex-1 items-center justify-center rounded-full px-3',
                        dateMode === option ? 'bg-surface' : '',
                      )}
                    >
                      <Text
                        weight="medium"
                        className={cn(
                          'text-sm',
                          dateMode === option
                            ? 'text-on-background'
                            : 'text-on-surface-variant',
                        )}
                      >
                        {option === 'all' ? tf('allTime') : tf('month')}
                      </Text>
                    </TwPressable>
                  ))}
                </TwView>
                <Text
                  weight="medium"
                  className="px-1 pt-2 text-xs text-on-surface-variant"
                >
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
              </TwView>
            ) : null}
          </ScrollView>
          <Button
            variant="secondary"
            label={tc('done')}
            onPress={() => setOpen(false)}
          />
        </Sheet>
      ) : null}
    </TwView>
  );
}
