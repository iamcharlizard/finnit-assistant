'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowUpDown,
  ChevronDown,
  CircleDot,
  CreditCard,
  Search,
  Shapes,
  X,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@finnit/ui/components/ui/dropdown-menu';
import { InputWithIcon } from '@finnit/ui/components/ui/input-with-icon';
import { cn } from '@finnit/ui/lib/utils';

import {
  DEFAULT_EXPENSE_FILTERS,
  EXPENSE_SORTS,
  STATUS_FILTERS,
  activeFilterCount,
  type ExpenseFilters,
  type ExpenseSort,
  type FilterOption,
  type StatusFilter,
} from '@finnit/core/recurring/filters';
import type { RecurringKind } from '@finnit/core/finance/types';

/**
 * The filter bar of "Mis pagos": search, then one dropdown per filter
 * (status, type and account take several values; sort one), and below the
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
  /** How many payments pass the filters. */
  count: number;
}) {
  const t = useTranslations('recurring');
  const tf = useTranslations('recurring.filters');
  const set = (patch: Partial<ExpenseFilters>) =>
    onChange({ ...filters, ...patch });
  const toggle = <T extends string>(list: T[], value: T, on: boolean) =>
    on ? [...list, value] : list.filter((v) => v !== value);

  const kindLabel = (kind: string) =>
    kinds.find((k) => k.value === kind)?.label ?? kind;
  const accountLabel = (id: string) =>
    accounts.find((a) => a.value === id)?.label ?? id;

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...(filters.status !== DEFAULT_EXPENSE_FILTERS.status
      ? [
          {
            key: 'status',
            label: tf('statusValue', {
              value: t(`list.status.${filters.status}`),
            }),
            remove: () => set({ status: DEFAULT_EXPENSE_FILTERS.status }),
          },
        ]
      : []),
    ...filters.kinds.map((kind) => ({
      key: `kind:${kind}`,
      label: kindLabel(kind),
      remove: () => set({ kinds: filters.kinds.filter((k) => k !== kind) }),
    })),
    ...filters.accounts.map((id) => ({
      key: `account:${id}`,
      label: accountLabel(id),
      remove: () => set({ accounts: filters.accounts.filter((a) => a !== id) }),
    })),
  ];
  const anyFilter = activeFilterCount(filters) > 0 || filters.q.trim() !== '';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 @2xl:flex-row @2xl:items-center">
        <div role="search" className="min-w-0 @2xl:max-w-sm @2xl:flex-1">
          <InputWithIcon
            iconLeft={Search}
            type="search"
            placeholder={tf('search')}
            aria-label={tf('searchLabel')}
            value={filters.q}
            onChange={(event) => set({ q: event.target.value })}
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] @2xl:mx-0 @2xl:overflow-visible @2xl:px-0 @2xl:pb-0">
          <FilterMenu
            icon={CircleDot}
            label={tf('status')}
            value={
              filters.status !== DEFAULT_EXPENSE_FILTERS.status
                ? t(`list.status.${filters.status}`)
                : null
            }
          >
            <DropdownMenuRadioGroup
              value={filters.status}
              onValueChange={(status) =>
                set({ status: status as StatusFilter })
              }
            >
              {STATUS_FILTERS.map((status) => (
                <DropdownMenuRadioItem key={status} value={status}>
                  {t(`list.status.${status}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </FilterMenu>

          {kinds.length > 1 ? (
            <FilterMenu
              icon={Shapes}
              label={tf('kind')}
              count={filters.kinds.length}
            >
              {kinds.map((kind) => (
                <DropdownMenuCheckboxItem
                  key={kind.value}
                  checked={filters.kinds.includes(kind.value)}
                  onCheckedChange={(on) =>
                    set({ kinds: toggle(filters.kinds, kind.value, on) })
                  }
                >
                  <span className="flex-1">{kind.label}</span>
                  <span className="text-xs text-on-surface-variant tabular-nums">
                    {kind.count}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </FilterMenu>
          ) : null}

          {accounts.length > 1 ? (
            <FilterMenu
              icon={CreditCard}
              label={tf('account')}
              count={filters.accounts.length}
            >
              {accounts.map((account) => (
                <DropdownMenuCheckboxItem
                  key={account.value}
                  checked={filters.accounts.includes(account.value)}
                  onCheckedChange={(on) =>
                    set({
                      accounts: toggle(filters.accounts, account.value, on),
                    })
                  }
                >
                  <span className="min-w-0 flex-1 truncate">
                    {account.label}
                  </span>
                  <span className="text-xs text-on-surface-variant tabular-nums">
                    {account.count}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </FilterMenu>
          ) : null}

          <FilterMenu
            icon={ArrowUpDown}
            label={tf('sort')}
            value={tf(`sorts.${filters.sort}`)}
            className="@2xl:ml-auto"
          >
            <DropdownMenuRadioGroup
              value={filters.sort}
              onValueChange={(sort) => set({ sort: sort as ExpenseSort })}
            >
              {EXPENSE_SORTS.map((sort) => (
                <DropdownMenuRadioItem key={sort} value={sort}>
                  {tf(`sorts.${sort}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </FilterMenu>
        </div>
      </div>

      {anyFilter ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 py-1 pr-1 pl-3 text-xs font-medium text-brand-ink"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.remove}
                aria-label={tf('remove', { name: chip.label })}
                className="flex size-6 items-center justify-center rounded-full outline-none hover:bg-brand/15 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </span>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({ ...DEFAULT_EXPENSE_FILTERS, sort: filters.sort })
            }
          >
            {tf('clear')}
          </Button>
          <span
            role="status"
            className="ml-auto text-xs text-on-surface-variant"
          >
            {tf('results', { count })}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** One filter's button: its name, then what it holds (a value or a count). */
function FilterMenu({
  icon: Icon,
  label,
  value,
  count = 0,
  className,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | null;
  count?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const on = Boolean(value) || count > 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'shrink-0 gap-1.5 rounded-full',
            on && 'border-brand/40 bg-brand/5',
            className,
          )}
        >
          <Icon aria-hidden />
          <span>{label}</span>
          {value ? (
            <span className="font-normal text-on-surface-variant">
              · {value}
            </span>
          ) : null}
          {count > 0 ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-brand-foreground">
              {count}
            </span>
          ) : null}
          <ChevronDown aria-hidden className="text-on-surface-variant" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
