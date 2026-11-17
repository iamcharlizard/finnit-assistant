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
import { Label } from '@finnit/ui/components/ui/label';
import { MoneyInput } from '@finnit/ui/components/ui/money-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@finnit/ui/components/ui/select';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';

import {
  debtErrorMessage,
  updateCardInstallment,
} from '@finnit/core/debts/api';
import {
  cutoffFor,
  cutoffsFrom,
  dueDateAfter,
  type CardCutTerms,
} from '@finnit/core/debts/card-installments';
import type { ScheduleRow } from '@finnit/core/debts/detail-view';
import {
  addDays,
  isDayKey,
  shortDate,
  type DayKey,
} from '@finnit/core/finance/dates';
import { parseAmount } from '@finnit/core/new-entry/form';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

/**
 * One installment of a card purchase: the cut-off that bills it (picked
 * from the card's cut-offs, each with the day that statement is paid; a
 * free date without the card's terms) and its amount; optionally the next
 * ones follow it. Mounted while open.
 */
export function InstallmentEditDialog({
  row,
  total,
  terms,
  onClose,
  onSaved,
}: {
  row: ScheduleRow & { editOccurrenceId: string };
  /** How many installments the purchase has. */
  total: number;
  /** The card's cut-off and payment days, when known. */
  terms: CardCutTerms | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const exit = useDialogExit();
  const { t } = useLocalizer();
  const te = useTranslations('debts.detail.editInstallment');
  const locale = useLocale();
  const [day, setDay] = React.useState<DayKey | ''>(
    terms ? cutoffFor(row.dueDate, terms) : row.dueDate,
  );
  const selectId = React.useId();
  // From a year before to two years after, around its cut-off.
  const cutoffs = React.useMemo(
    () =>
      terms
        ? cutoffsFrom(addDays(cutoffFor(row.dueDate, terms), -366), 37, terms)
        : null,
    [terms, row.dueDate],
  );
  const cutoffLabel = (cut: DayKey) => {
    const due = terms ? dueDateAfter(cut, terms) : null;
    return due
      ? t('debts.cardInstallments.scheduleCutoff', {
          cut: shortDate(cut, locale),
          due: shortDate(due, locale),
        })
      : shortDate(cut, locale);
  };
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
            <DialogDescription>
              {te(terms ? 'descriptionCutoff' : 'description')}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {cutoffs ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={selectId} className="px-1">
                  {te('cutoff')}
                </Label>
                <Select value={day} onValueChange={(next) => setDay(next)}>
                  <SelectTrigger id={selectId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cutoffs.map((cut) => (
                      <SelectItem key={cut} value={cut}>
                        {cutoffLabel(cut)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <DatePicker
                label={te('date')}
                value={day || undefined}
                onChange={(next) => setDay(next ?? '')}
                locale={locale}
              />
            )}
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
                  {te(terms ? 'shiftCutoffs' : 'shift')}
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
