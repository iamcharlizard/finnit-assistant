'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@finnit/ui/components/ui/button';
import { Checkbox } from '@finnit/ui/components/ui/checkbox';
import { DatePicker } from '@finnit/ui/components/ui/date-picker';
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
import { MoneyInput } from '@finnit/ui/components/ui/money-input';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';

import {
  debtErrorMessage,
  updateCardInstallment,
} from '@finnit/core/debts/api';
import type { ScheduleRow } from '@finnit/core/debts/detail-view';
import { isDayKey, type DayKey } from '@finnit/core/finance/dates';
import { parseAmount } from '@finnit/core/new-entry/form';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

/**
 * One installment of a card purchase: the day the card bills it and its
 * amount; optionally the next ones go to that day of the following months.
 * Mounted while open.
 */
export function InstallmentEditDialog({
  row,
  total,
  onClose,
  onSaved,
}: {
  row: ScheduleRow & { editOccurrenceId: string };
  /** How many installments the purchase has. */
  total: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const exit = useDialogExit();
  const { t } = useLocalizer();
  const te = useTranslations('debts.detail.editInstallment');
  const locale = useLocale();
  const [day, setDay] = React.useState<DayKey | ''>(row.dueDate);
  const [amount, setAmount] = React.useState(row.amount.toFixed(2));
  const [shift, setShift] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const value = parseAmount(amount);
  const amountError =
    value === null || value <= 0 ? te('amountRequired') : null;
  const isLast = row.number >= total;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isDayKey(day)) {
      setError(te('dateRequired'));
      return;
    }
    if (amountError || value === null) return;
    setSaving(true);
    setError(null);
    try {
      await updateCardInstallment(
        {
          occurrenceId: row.editOccurrenceId,
          dueDate: day,
          amount: value,
          shiftFollowing: shift && !isLast,
        },
        gql,
      );
      exit.after(onSaved)();
    } catch (cause) {
      setError(debtErrorMessage(cause, t));
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
        className="sm:max-w-md"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>
              {te('title', { number: row.number, total })}
            </DialogTitle>
            <DialogDescription>{te('description')}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <DatePicker
              label={te('date')}
              value={day || undefined}
              onChange={(next) => setDay(next ?? '')}
              locale={locale}
            />
            <MoneyInput
              label={te('amount')}
              value={amount}
              onValueChange={setAmount}
              error={amountError ?? undefined}
            />
            {isLast ? null : (
              <div className="flex items-center gap-3 px-1">
                <Checkbox
                  id="installment-shift"
                  checked={shift}
                  onCheckedChange={(checked) => setShift(checked === true)}
                />
                <label
                  htmlFor="installment-shift"
                  className="text-sm text-on-surface-variant"
                >
                  {te('shift')}
                </label>
              </div>
            )}
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
            <Button type="submit" variant="secondary" disabled={saving}>
              {saving ? te('saving') : te('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
