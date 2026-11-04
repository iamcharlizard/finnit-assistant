'use client';

import * as React from 'react';

import { toast } from '@finnit/ui/components/ui/toaster';

import {
  ConfirmDialog,
  type ConfirmRequest,
} from '@/components/admin/confirm-dialog';
import type { BudgetCategory } from '@/lib/budgets/types';
import { debtErrorMessage, deleteDebt } from '@/lib/debts/api';
import type { ApiDebt } from '@/lib/debts/types';
import type { DebtItem } from '@/lib/debts/view';
import type { DayKey } from '@/lib/finance/dates';
import type { ApiAccount } from '@/lib/finance/types';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { DebtCard } from './debt-card';
import { DebtDialog } from './debt-dialog';
import { PaymentDialog } from './payment-dialog';

/**
 * Debt cards with their actions (pay, edit, delete) and the dialogs those
 * open. `onChanged` runs after anything is saved, to reload the page data.
 */
export function DebtList({
  items,
  accounts,
  categories,
  today,
  onChanged,
}: {
  items: DebtItem[];
  accounts: ApiAccount[];
  categories: BudgetCategory[];
  today: DayKey;
  onChanged: () => void;
}) {
  const { t } = useLocalizer();
  const [editing, setEditing] = React.useState<ApiDebt | null>(null);
  const [paying, setPaying] = React.useState<DebtItem | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  function askDelete(item: DebtItem) {
    setConfirm({
      title: t('debts.delete.title', { name: item.name }),
      description: t('debts.delete.description'),
      confirmLabel: t('debts.delete.confirm'),
      destructive: true,
      onConfirm: async () => {
        setConfirm(null);
        setBusyId(item.id);
        try {
          await deleteDebt(item.id, gql);
          toast.success(t('debts.toasts.deleted', { name: item.name }));
          onChanged();
        } catch (error) {
          toast.error(debtErrorMessage(error, t));
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function onSaved(changed: boolean, name: string) {
    setEditing(null);
    if (!changed) {
      toast(t('debts.toasts.noChanges'));
      return;
    }
    toast.success(t('debts.toasts.updated', { name }));
    onChanged();
  }

  function onPaid() {
    const item = paying;
    setPaying(null);
    if (item) toast.success(t('debts.toasts.paid', { name: item.name }));
    onChanged();
  }

  return (
    <>
      <ul className="grid gap-3 @2xl:grid-cols-2 @4xl:grid-cols-3">
        {items.map((item) => (
          <DebtCard
            key={item.id}
            item={item}
            busy={busyId === item.id}
            onPay={() => setPaying(item)}
            onEdit={() => setEditing(item.debt)}
            onDelete={() => askDelete(item)}
          />
        ))}
      </ul>

      {editing ? (
        <DebtDialog
          debt={editing}
          accounts={accounts}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      ) : null}
      {paying ? (
        <PaymentDialog
          debt={paying.debt}
          remainingLabel={paying.remaining}
          accounts={accounts}
          categories={categories}
          today={today}
          onClose={() => setPaying(null)}
          onSaved={onPaid}
        />
      ) : null}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
