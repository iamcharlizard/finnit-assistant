import * as React from 'react';
import { ScrollView } from 'react-native';
import { useTranslations } from 'use-intl';
import { ArrowUpDown, Check, ChevronDown, CircleDot, CreditCard, Search, Shapes, X, type LucideIcon } from 'lucide-react-native';

import {
  DEFAULT_EXPENSE_FILTERS,
  EXPENSE_SORTS,
  STATUS_FILTERS,
  activeFilterCount,
  type ExpenseFilters,
  type FilterOption,
} from '@finnit/core/recurring/filters';
import type { RecurringKind } from '@finnit/core/finance/types';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Checkbox } from '@finnit/ui-native/components/ui/checkbox';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Input } from '@finnit/ui-native/components/ui/input';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

type Menu = 'status' | 'kind' | 'account' | 'sort';

/**
 * The filter bar of "Mis pagos" (the web's): search, a row of filter
 * buttons that open a sheet each (status, type, account, sort), and the
 * filters in use as removable chips.
 */
export function ExpenseFiltersBar({
  filters,
  onChange,
  kinds,
  accounts,
  count,
}: {
  filters: ExpenseFilters;
  onChange: (next: ExpenseFilters) => void;
  kinds: FilterOption<RecurringKind>[];
  accounts: FilterOption[];
  count: number;
}) {
  const t = useTranslations();
  const tf = useTranslations('recurring.filters');
  const [menu, setMenu] = React.useState<Menu | null>(null);
  const set = (patch: Partial<ExpenseFilters>) => onChange({ ...filters, ...patch });
  const toggle = <T extends string>(list: T[], value: T, on: boolean) => (on ? [...list, value] : list.filter((v) => v !== value));
  const statusLabel = (status: string) => t(`recurring.list.status.${status as 'active'}`);

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...(filters.status !== DEFAULT_EXPENSE_FILTERS.status
      ? [{ key: 'status', label: tf('statusValue', { value: statusLabel(filters.status) }), remove: () => set({ status: DEFAULT_EXPENSE_FILTERS.status }) }]
      : []),
    ...filters.kinds.map((kind) => ({
      key: `kind:${kind}`,
      label: kinds.find((k) => k.value === kind)?.label ?? kind,
      remove: () => set({ kinds: filters.kinds.filter((k) => k !== kind) }),
    })),
    ...filters.accounts.map((id) => ({
      key: `account:${id}`,
      label: accounts.find((a) => a.value === id)?.label ?? id,
      remove: () => set({ accounts: filters.accounts.filter((a) => a !== id) }),
    })),
  ];
  const anyFilter = activeFilterCount(filters) > 0 || filters.q.trim() !== '';

  return (
    <TwView className="gap-3">
      <Input
        icon={Search}
        placeholder={tf('search')}
        accessibilityLabel={tf('searchLabel')}
        value={filters.q}
        onChangeText={(q) => set({ q })}
        returnKeyType="search"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <MenuButton
          icon={CircleDot}
          label={tf('status')}
          value={filters.status !== DEFAULT_EXPENSE_FILTERS.status ? statusLabel(filters.status) : null}
          onPress={() => setMenu('status')}
        />
        {kinds.length > 1 ? <MenuButton icon={Shapes} label={tf('kind')} count={filters.kinds.length} onPress={() => setMenu('kind')} /> : null}
        {accounts.length > 1 ? (
          <MenuButton icon={CreditCard} label={tf('account')} count={filters.accounts.length} onPress={() => setMenu('account')} />
        ) : null}
        <MenuButton icon={ArrowUpDown} label={tf('sort')} value={tf(`sorts.${filters.sort}`)} onPress={() => setMenu('sort')} />
      </ScrollView>

      {anyFilter ? (
        <TwView className="flex-row flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <TwPressable
              key={chip.key}
              accessibilityRole="button"
              accessibilityLabel={tf('remove', { name: chip.label })}
              onPress={chip.remove}
              className="flex-row items-center gap-1 rounded-full border border-brand-30 bg-brand-10 py-1 pr-2 pl-3"
            >
              <Text weight="medium" className="text-xs text-brand-ink">
                {chip.label}
              </Text>
              <Icon icon={X} size={14} color="--brand-ink" />
            </TwPressable>
          ))}
          <Button variant="ghost" size="sm" label={tf('clear')} onPress={() => onChange({ ...DEFAULT_EXPENSE_FILTERS, sort: filters.sort })} />
          <Text className="ml-auto text-xs text-on-surface-variant">{tf('results', { count })}</Text>
        </TwView>
      ) : null}

      {menu ? (
        <Sheet open onOpenChange={(open) => !open && setMenu(null)} title={tf(menu)} closeLabel={t('common.close')}>
          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 4, paddingBottom: 8 }}>
            {menu === 'status'
              ? STATUS_FILTERS.map((status) => (
                  <ChoiceRow
                    key={status}
                    label={statusLabel(status)}
                    selected={filters.status === status}
                    onPress={() => {
                      set({ status });
                      setMenu(null);
                    }}
                  />
                ))
              : null}
            {menu === 'sort'
              ? EXPENSE_SORTS.map((sort) => (
                  <ChoiceRow
                    key={sort}
                    label={tf(`sorts.${sort}`)}
                    selected={filters.sort === sort}
                    onPress={() => {
                      set({ sort });
                      setMenu(null);
                    }}
                  />
                ))
              : null}
            {menu === 'kind'
              ? kinds.map((kind) => (
                  <TwView key={kind.value} className="flex-row items-center justify-between gap-3 px-1 py-2">
                    <Checkbox
                      className="flex-1"
                      label={kind.label}
                      checked={filters.kinds.includes(kind.value)}
                      onCheckedChange={(on) => set({ kinds: toggle(filters.kinds, kind.value, on) })}
                    />
                    <Text className="text-xs text-on-surface-variant">{kind.count}</Text>
                  </TwView>
                ))
              : null}
            {menu === 'account'
              ? accounts.map((account) => (
                  <TwView key={account.value} className="flex-row items-center justify-between gap-3 px-1 py-2">
                    <Checkbox
                      className="flex-1"
                      label={account.label}
                      checked={filters.accounts.includes(account.value)}
                      onCheckedChange={(on) => set({ accounts: toggle(filters.accounts, account.value, on) })}
                    />
                    <Text className="text-xs text-on-surface-variant">{account.count}</Text>
                  </TwView>
                ))
              : null}
          </ScrollView>
          {menu === 'kind' || menu === 'account' ? (
            <Button variant="secondary" label={t('common.done')} onPress={() => setMenu(null)} />
          ) : null}
        </Sheet>
      ) : null}
    </TwView>
  );
}

function MenuButton({
  icon,
  label,
  value,
  count = 0,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | null;
  count?: number;
  onPress: () => void;
}) {
  const on = Boolean(value) || count > 0;
  return (
    <TwPressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      onPress={onPress}
      className={cn('min-h-10 flex-row items-center gap-1.5 rounded-full border px-3', on ? 'border-brand-40 bg-brand-5' : 'border-input bg-surface')}
    >
      <Icon icon={icon} size={16} color="--on-surface-variant" />
      <Text weight="medium" className="text-sm">
        {label}
      </Text>
      {value ? <Text className="text-sm text-on-surface-variant">· {value}</Text> : null}
      {count > 0 ? (
        <TwView className="size-5 items-center justify-center rounded-full bg-brand">
          <Text weight="bold" className="text-[11px] text-brand-foreground">
            {count}
          </Text>
        </TwView>
      ) : null}
      <Icon icon={ChevronDown} size={14} color="--on-surface-variant" />
    </TwPressable>
  );
}

function ChoiceRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TwPressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="min-h-11 flex-row items-center justify-between gap-3 rounded-lg px-3 active:bg-accent"
    >
      <Text weight={selected ? 'medium' : undefined} className="text-sm">
        {label}
      </Text>
      {selected ? <Icon icon={Check} size={18} color="--brand-ink" /> : null}
    </TwPressable>
  );
}
