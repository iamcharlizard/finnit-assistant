'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRightLeft, Receipt } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Combobox } from '@finnit/ui/components/ui/combobox';
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
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';
import { MoneyInput } from '@finnit/ui/components/ui/money-input';

import { budgetCategoryOptions } from '@/lib/budgets/options';
import type { BudgetCategory } from '@/lib/budgets/types';
import { debtErrorMessage, registerDebtPayment } from '@/lib/debts/api';
import {
  buildPaymentMovement,
  hasErrors,
  newPaymentForm,
  paymentMode,
  paymentSources,
  validatePaymentForm,
  type PaymentErrorCode,
  type PaymentForm,
  type PaymentFormErrors,
} from '@/lib/debts/form';
import type { ApiDebt } from '@/lib/debts/types';
import { accountLabel } from '@/lib/finance/accounts';
import type { DayKey } from '@/lib/finance/dates';
import type { ApiAccount } from '@/lib/finance/types';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { accountOptions } from '@/lib/new-entry/options';

/**
 * Registers a payment: the movement that moved the money (a transfer to a
 * linked credit card, otherwise an expense) and the debt payment linked to
 * it. With `installment` it pays that scheduled payment of a loan (amount
 * prefilled). Mounted while open.
 */
export function PaymentDialog({
  debt,
  remainingLabel,
  installment,
  accounts,
  categories,
  today,
  onClose,
  onSaved,
}: {
  debt: ApiDebt;
  /** What is still owed, formatted. */
  remainingLabel: string;
  installment?: { occurrenceId: string; amount: number };
  accounts: ApiAccount[];
  categories: BudgetCategory[];
  today: DayKey;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Closes with the exit animation before telling the parent.
  const exit = useDialogExit();
  const { t } = useLocalizer();
  const tf = useTranslations('debts.payment');
  const locale = useLocale();
  const mode = React.useMemo(
    () => paymentMode(debt, accounts),
    [debt, accounts],
  );
  const sources = React.useMemo(
    () => paymentSources(mode, accounts),
    [mode, accounts],
  );
  const [form, setForm] = React.useState<PaymentForm>(() =>
    newPaymentForm(
      installment
        ? { ...debt, minPaymentAmount: installment.amount }
        : debt.installmentAmount != null
          ? { ...debt, minPaymentAmount: debt.installmentAmount }
          : debt,
      {
        today,
        accountId: sources.length === 1 ? sources[0]!.id : '',
      },
    ),
  );
  const [errors, setErrors] = React.useState<PaymentFormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const sourceItems = React.useMemo(() => accountOptions(sources), [sources]);
  const categoryItems = React.useMemo(
    () => budgetCategoryOptions(categories, locale),
    [categories, locale],
  );
  const errorText = (code: PaymentErrorCode | undefined) =>
    code ? t(`debts.paymentValidation.${code}`) : undefined;

  function update(patch: Partial<PaymentForm>) {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch))
        delete next[key as keyof PaymentForm];
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validatePaymentForm(form, {
      remaining: debt.remainingBalance,
      today,
    });
    setErrors(found);
    const account = sources.find((a) => a.id === form.accountId);
    if (hasErrors(found) || !account) return;
    setSaving(true);
    setSubmitError(null);
    try {
      await registerDebtPayment(
        debt.id,
        buildPaymentMovement(form, {
          debt,
          mode,
          account,
          description: tf('movementDescription', { name: debt.name }),
        }),
        gql,
        { occurrenceId: installment?.occurrenceId },
      );
      exit.after(onSaved)();
    } catch (error) {
      setSubmitError(debtErrorMessage(error, t));
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
            <DialogTitle>{tf('title')}</DialogTitle>
            <DialogDescription>
              {tf('description', { name: debt.name, amount: remainingLabel })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <p className="flex items-start gap-2 rounded-input bg-track/60 p-3 text-xs text-on-background">
              {mode.kind === 'transfer' ? (
                <ArrowRightLeft aria-hidden className="size-4 shrink-0" />
              ) : (
                <Receipt aria-hidden className="size-4 shrink-0" />
              )}
              {mode.kind === 'transfer'
                ? tf('transferNote', { card: accountLabel(mode.card) })
                : tf('expenseNote')}
            </p>

            <MoneyInput
              label={tf('amount')}
              value={form.amount}
              onValueChange={(value) => update({ amount: value })}
              error={errorText(errors.amount)}
            />
            <DatePicker
              label={tf('date')}
              value={form.date || undefined}
              onChange={(day) => update({ date: day ?? '' })}
              max={today}
              locale={locale}
              placeholder={tf('datePlaceholder')}
              required
              error={errorText(errors.date)}
            />
            {sources.length > 0 ? (
              <Combobox
                label={tf('account')}
                options={sourceItems}
                value={form.accountId || undefined}
                onChange={(accountId) => update({ accountId: accountId ?? '' })}
                placeholder={tf('accountPlaceholder')}
                searchPlaceholder={tf('accountSearch')}
                emptyText={tf('noResults')}
                error={errorText(errors.accountId)}
              />
            ) : (
              <p role="alert" className="text-[13px] text-expense">
                {mode.kind === 'transfer'
                  ? tf('noSourcesTransfer')
                  : tf('noSources')}
              </p>
            )}
            {mode.kind === 'expense' ? (
              <Combobox
                label={tf('category')}
                options={categoryItems}
                value={form.categoryId || undefined}
                onChange={(categoryId) =>
                  update({ categoryId: categoryId ?? '' })
                }
                placeholder={tf('categoryPlaceholder')}
                searchPlaceholder={tf('categorySearch')}
                emptyText={tf('noResults')}
                clearable
              />
            ) : null}

            {submitError ? (
              <p role="alert" className="text-[13px] text-expense">
                {submitError}
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
              disabled={saving || sources.length === 0}
            >
              {saving ? tf('saving') : tf('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
