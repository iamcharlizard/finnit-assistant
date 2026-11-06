'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@finnit/ui/components/ui/dialog';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';

import { debtErrorMessage } from '@finnit/core/debts/api';
import { linkLoanPayment } from '@finnit/core/debts/links';
import type { DayKey } from '@finnit/core/finance/dates';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { ExpensePicker } from './expense-picker';

/**
 * "Ligar gasto" on a loan payment already paid without a movement (paid
 * before registering the loan): pick the expense that paid it. Mounted
 * while open.
 */
export function LinkExpenseDialog({
  occurrenceId,
  dateLabel,
  amountLabel,
  today,
  onClose,
  onLinked,
}: {
  occurrenceId: string;
  dateLabel: string;
  amountLabel: string;
  today: DayKey;
  onClose: () => void;
  onLinked: () => void;
}) {
  const exit = useDialogExit();
  const { t } = useLocalizer();
  const tl = useTranslations('debts.links');
  const [transactionId, setTransactionId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!transactionId) return;
    setSaving(true);
    setError(null);
    try {
      await linkLoanPayment(occurrenceId, transactionId, gql);
      exit.after(onLinked)();
    } catch (e) {
      setError(debtErrorMessage(e, t));
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={exit.open}
      onOpenChange={(open) => !open && !saving && exit.close(onClose)}
    >
      <DialogContent
        onExitComplete={exit.onExitComplete}
        closeLabel={t('common.close')}
        className="sm:max-w-lg"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{tl('expense.title')}</DialogTitle>
            <DialogDescription>
              {tl('expense.description', {
                date: dateLabel,
                amount: amountLabel,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <ExpensePicker
              occurrenceId={occurrenceId}
              today={today}
              value={transactionId}
              onChange={setTransactionId}
            />
            {error ? (
              <p role="alert" className="text-[13px] text-expense">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="secondary"
              disabled={saving || !transactionId}
            >
              {saving ? tl('saving') : tl('expense.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
