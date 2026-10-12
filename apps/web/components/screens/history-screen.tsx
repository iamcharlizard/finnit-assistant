'use client';

import * as React from 'react';
import { Inbox, Search } from 'lucide-react';

import { FilterChipGroup } from '@finnit/ui/components/finance/filter-chip-group';
import { MonthlyBudgetCard } from '@finnit/ui/components/finance/monthly-budget-card';
import { NeoTipCard } from '@finnit/ui/components/finance/neo-tip-card';
import { PopularCategoriesCard } from '@finnit/ui/components/finance/popular-categories-card';
import { TransactionItemWithStatus } from '@finnit/ui/components/finance/transaction-item-with-status';
import { InputWithIcon } from '@finnit/ui/components/ui/input-with-icon';
import { LabelSm } from '@finnit/ui/components/ui/typography';

import {
  FILTER_OPTIONS,
  MOCK_GROUPS,
  POPULAR_CATEGORIES,
  type FilterValue,
  type HistoryTransaction,
} from '@/lib/mocks/history';

function matchesFilter(tx: HistoryTransaction, filter: FilterValue): boolean {
  if (filter === 'all') return true;
  if (filter === 'income') return tx.itemVariant === 'income';
  if (filter === 'expenses') return tx.itemVariant !== 'income';
  return false;
}

function matchesSearch(tx: HistoryTransaction, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    tx.merchant.toLowerCase().includes(q) ||
    tx.category.toLowerCase().includes(q)
  );
}

function isFilterValue(value: string): value is FilterValue {
  return FILTER_OPTIONS.some((o) => o.value === value);
}

export function HistoryScreen() {
  const [activeFilter, setActiveFilter] = React.useState<FilterValue>('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredGroups = MOCK_GROUPS.map((group) => ({
    ...group,
    transactions: group.transactions.filter(
      (tx) => matchesFilter(tx, activeFilter) && matchesSearch(tx, searchQuery),
    ),
  })).filter((group) => group.transactions.length > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-2">
        <h1 className="mb-1 text-[32px] font-bold text-on-background">
          Historial
        </h1>
        <p className="mb-6 text-sm text-on-surface-variant">
          Revisa y filtra todos tus movimientos financieros en tiempo real.
        </p>

        <div role="search" className="mb-4">
          <InputWithIcon
            iconLeft={Search}
            type="search"
            placeholder="Buscar transacción, comercio..."
            aria-label="Buscar transacciones por comercio o categoría"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <FilterChipGroup
          items={FILTER_OPTIONS}
          activeValue={activeFilter}
          onSelect={(v) => {
            if (isFilterValue(v)) setActiveFilter(v);
          }}
          aria-label="Filtrar por tipo"
          className="mb-6"
        />

        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Inbox aria-hidden className="size-11 text-on-surface-variant/50" />
            <p className="text-base text-on-surface-variant">Sin resultados</p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <section key={group.id} className="mb-8">
              <LabelSm as="h2" className="mb-3 block px-1">
                {group.dateLabel}
              </LabelSm>
              <div className="flex flex-col gap-2">
                {group.transactions.map((tx) => (
                  <TransactionItemWithStatus
                    key={tx.id}
                    merchant={tx.merchant}
                    category={tx.category}
                    time={tx.time}
                    amount={tx.amount}
                    statusLabel={tx.statusLabel}
                    statusVariant={tx.statusVariant}
                    itemVariant={tx.itemVariant}
                    icon={tx.icon}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <aside className="flex flex-col gap-4 lg:pt-[92px]">
        <MonthlyBudgetCard amount="$2,480" cents=".50" usedPercent={75} />
        <NeoTipCard
          title="Finnit AI"
          body="“Tus gastos en tecnología han subido un 12% este mes. Considera revisar tus suscripciones activas.”"
          actionLabel="Ver Análisis"
        />
        <PopularCategoriesCard categories={POPULAR_CATEGORIES} />
      </aside>
    </div>
  );
}
