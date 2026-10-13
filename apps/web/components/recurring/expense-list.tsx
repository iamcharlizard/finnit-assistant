'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Repeat, SearchX } from 'lucide-react';

import { FilterChipGroup } from '@finnit/ui/components/finance/filter-chip-group';
import { Button } from '@finnit/ui/components/ui/button';

import { EmptyState } from '@/components/finance/empty-state';
import {
  filterExpenses,
  kindFilterOptions,
  type StatusFilter,
} from '@/lib/recurring/filters';
import type { ExpenseItem } from '@/lib/recurring/view';
import { ExpenseCard } from './expense-card';

const STATUS_FILTERS: StatusFilter[] = ['active', 'paused', 'all'];

/** "Mis pagos recurrentes": every expense, filtered by kind and status. */
export function ExpenseList({
  expenses,
  busyId,
  onCreate,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  expenses: ExpenseItem[];
  busyId: string | null;
  onCreate: () => void;
  onEdit: (item: ExpenseItem) => void;
  onToggleActive: (item: ExpenseItem) => void;
  onDelete: (item: ExpenseItem) => void;
}) {
  const t = useTranslations();
  const [kind, setKind] = React.useState('all');
  const [status, setStatus] = React.useState<StatusFilter>('active');

  const kinds = kindFilterOptions(expenses);
  // A kind filter whose last expense is gone falls back to all.
  const activeKind =
    kind === 'all' || (kinds as string[]).includes(kind) ? kind : 'all';
  const shown = filterExpenses(expenses, { kind: activeKind, status });

  return (
    <section
      aria-labelledby="recurring-list-title"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2
            id="recurring-list-title"
            className="text-title-lg font-bold text-on-background"
          >
            {t('recurring.list.title')}
          </h2>
          <span className="text-xs text-on-surface-variant">
            {t('recurring.list.count', { count: expenses.length })}
          </span>
        </div>
      </div>

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
          <div className="flex flex-col gap-2">
            <FilterChipGroup
              aria-label={t('recurring.list.filterStatus')}
              items={STATUS_FILTERS.map((value) => ({
                value,
                label: t(`recurring.list.status.${value}`),
              }))}
              activeValue={status}
              onSelect={(value) => setStatus(value as StatusFilter)}
            />
            {kinds.length > 1 ? (
              <FilterChipGroup
                aria-label={t('recurring.list.filterKind')}
                items={[
                  { value: 'all', label: t('recurring.list.allKinds') },
                  ...kinds.map((value) => ({
                    value,
                    label: t(
                      `finance.recurringKinds.${value as ExpenseItem['kind']}`,
                    ),
                  })),
                ]}
                activeValue={activeKind}
                onSelect={setKind}
              />
            ) : null}
          </div>
          {shown.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t('recurring.list.emptyFiltered')}
              className="py-8"
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
    </section>
  );
}
