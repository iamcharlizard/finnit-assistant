'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus, Repeat, SearchX } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

import { EmptyState } from '@/components/finance/empty-state';
import {
  accountOptions,
  applyExpenseFilters,
  kindOptions,
  type ExpenseFilters,
} from '@finnit/core/recurring/filters';
import type { ExpenseItem } from '@finnit/core/recurring/view';
import { ExpenseCard } from './expense-card';
import { ExpenseFiltersBar } from './expense-filters';

/** "Mis pagos" tab: every expense, behind the filter bar. */
export function ExpenseList({
  expenses,
  filters,
  onFiltersChange,
  busyId,
  onCreate,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  expenses: ExpenseItem[];
  filters: ExpenseFilters;
  onFiltersChange: (next: ExpenseFilters) => void;
  busyId: string | null;
  onCreate: () => void;
  onEdit: (item: ExpenseItem) => void;
  onToggleActive: (item: ExpenseItem) => void;
  onDelete: (item: ExpenseItem) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const kinds = kindOptions(expenses, (kind) =>
    t(`finance.recurringKinds.${kind}`),
  );
  const accounts = accountOptions(
    expenses,
    t('calendar.summary.noAccount'),
    locale,
  );
  const shown = applyExpenseFilters(expenses, filters, locale);
  return (
    <div className="flex flex-col gap-4">
      {expenses.length === 0 ? (
        <div className="flex flex-col items-center gap-3">
          <EmptyState
            icon={Repeat}
            title={t('recurring.list.emptyTitle')}
            description={t('recurring.list.emptyDescription')}
            className="w-full"
          />
          <Button type="button" variant="secondary" onClick={onCreate}>
            <Plus aria-hidden /> {t('recurring.new')}
          </Button>
        </div>
      ) : (
        <>
          <ExpenseFiltersBar
            filters={filters}
            onChange={onFiltersChange}
            kinds={kinds}
            accounts={accounts}
            count={shown.length}
          />
          {shown.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t('recurring.list.emptyFiltered')}
              className="py-8"
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 @4xl:grid-cols-3">
              {shown.map((item) => (
                <ExpenseCard
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onEdit={() => onEdit(item)}
                  onToggleActive={() => onToggleActive(item)}
                  onDelete={() => onDelete(item)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
