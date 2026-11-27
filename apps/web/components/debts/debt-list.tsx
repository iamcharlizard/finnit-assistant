'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { toast } from '@finnit/ui/components/ui/toaster';

import {
  ConfirmDialog,
  type ConfirmRequest,
} from '@/components/admin/confirm-dialog';
import type { BudgetCategory } from '@finnit/core/budgets/types';
import { debtErrorMessage, deleteDebt } from '@finnit/core/debts/api';
import {
  pendingPayments,
  type PendingPayment,
} from '@finnit/core/debts/allocation';
import { buildLoanDetailView } from '@finnit/core/debts/detail-view';
import {
  DEBT_DETAIL_QUERY,
  type DebtDetailResult,
} from '@finnit/core/debts/request';
import {
  isCardInstallments,
  isLoanContainer,
  type ApiDebt,
} from '@finnit/core/debts/types';
import type { DebtItem } from '@finnit/core/debts/view';
import type { DayKey } from '@finnit/core/finance/dates';
import type { ApiAccount } from '@finnit/core/finance/types';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { SwitchField } from '@/components/finance/switch-field';
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
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Paid-off debts are hidden unless asked for (kept in the URL).
  const showPaidOff = params.get('paidOff') === '1';
  const paidOffCount = items.filter((item) => item.paidOff).length;
  const shown = showPaidOff ? items : items.filter((item) => !item.paidOff);
  function setShowPaidOff(show: boolean) {
    const next = new URLSearchParams(params.toString());
    if (show) next.set('paidOff', '1');
    else next.delete('paidOff');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }
  const [editing, setEditing] = React.useState<ApiDebt | null>(null);
  const [paying, setPaying] = React.useState<DebtItem | null>(null);
  // Purchase financing and personal loans: their pending payments, loaded
  // before opening the dialog so the payment can be split over them.
  const [pending, setPending] = React.useState<PendingPayment[] | undefined>();
  const l = useLocalizer();

  async function pay(item: DebtItem) {
    if (!isLoanContainer(item.debt)) {
      setPending(undefined);
      setPaying(item);
      return;
    }
    setBusyId(item.id);
    try {
      const data = await gql<DebtDetailResult>(DEBT_DETAIL_QUERY, {
        id: item.id,
        debtId: item.id,
      });
      const view = buildLoanDetailView(
        data.debt,
        data.loanSchedule,
        { today },
        l,
      );
      setPending(pendingPayments(view.schedule));
      setPaying(item);
    } catch (error) {
      toast.error(debtErrorMessage(error, t));
    } finally {
      setBusyId(null);
    }
  }
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
      {paidOffCount > 0 ? (
        <div className="mb-3 flex justify-end">
          <SwitchField
            label={t('debts.list.showPaidOff', { count: paidOffCount })}
            checked={showPaidOff}
            onCheckedChange={setShowPaidOff}
          />
        </div>
      ) : null}
      <ul className="grid gap-3 @2xl:grid-cols-2 @4xl:grid-cols-3">
        {shown.map((item) => (
          <DebtCard
            key={item.id}
            item={item}
            busy={busyId === item.id}
            onPay={() => void pay(item)}
            // A card purchase is edited on its page (its terms and installments).
            onEdit={() =>
              isCardInstallments(item.debt)
                ? router.push(item.href)
                : setEditing(item.debt)
            }
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
          pending={pending}
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
