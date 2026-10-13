'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';

import { FilterChipGroup } from '@finnit/ui/components/finance/filter-chip-group';
import { InputWithIcon } from '@finnit/ui/components/ui/input-with-icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@finnit/ui/components/ui/select';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  TYPE_OPTIONS,
  hasFilters,
  historyQuery,
  type HistoryFilters as Filters,
  type HistoryType,
} from '@/lib/history/filters';
import type { Option } from '@/lib/history/view';

const ALL = 'all';

const DATE_INPUT =
  'min-h-12 w-full rounded-xl border border-glass-border bg-track px-3 text-sm text-on-background outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

/** Search, type, account, category and dates; every change updates the URL. */
export function HistoryFilters({
  filters,
  accounts,
  categories,
}: {
  filters: Filters;
  accounts: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = React.useState(filters.search ?? '');
  const debouncedSearch = useDebouncedValue(search.trim(), 400);

  const apply = React.useCallback(
    (next: Filters) => {
      router.replace(`${pathname}${historyQuery(next)}`, { scroll: false });
    },
    [router, pathname],
  );

  React.useEffect(() => {
    if (debouncedSearch !== (filters.search ?? '')) {
      apply({ ...filters, search: debouncedSearch || undefined });
    }
  }, [debouncedSearch, filters, apply]);

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div role="search">
        <InputWithIcon
          iconLeft={Search}
          type="search"
          placeholder="Buscar por comercio o descripción"
          aria-label="Buscar transacciones por comercio o descripción"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <FilterChipGroup
        items={TYPE_OPTIONS}
        activeValue={filters.type ?? ALL}
        onSelect={(v) =>
          apply({
            ...filters,
            type: v === ALL ? undefined : (v as HistoryType),
          })
        }
        aria-label="Filtrar por tipo"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          value={filters.accountId ?? ALL}
          onValueChange={(v) =>
            apply({ ...filters, accountId: v === ALL ? undefined : v })
          }
        >
          <SelectTrigger aria-label="Cuenta" className="min-h-12 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las cuentas</SelectItem>
            {accounts.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.categoryId ?? ALL}
          onValueChange={(v) =>
            apply({ ...filters, categoryId: v === ALL ? undefined : v })
          }
        >
          <SelectTrigger aria-label="Categoría" className="min-h-12 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las categorías</SelectItem>
            {categories.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
          Desde
          <input
            type="date"
            className={DATE_INPUT}
            value={filters.from ?? ''}
            max={filters.to}
            onChange={(e) =>
              apply({ ...filters, from: e.target.value || undefined })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
          Hasta
          <input
            type="date"
            className={DATE_INPUT}
            value={filters.to ?? ''}
            min={filters.from}
            onChange={(e) =>
              apply({ ...filters, to: e.target.value || undefined })
            }
          />
        </label>
      </div>

      {hasFilters(filters) ? (
        <button
          type="button"
          onClick={() => {
            setSearch('');
            apply({});
          }}
          className="flex min-h-11 items-center gap-1 self-start text-sm font-medium text-income hover:underline"
        >
          <X aria-hidden className="size-4" /> Limpiar filtros
        </button>
      ) : null}
    </div>
  );
}
