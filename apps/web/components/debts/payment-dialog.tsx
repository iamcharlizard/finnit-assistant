'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRightLeft, Receipt } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Combobox } from '@finnit/ui/components/ui/combobox';
import { DatePicker } from '@finnit/ui/components/ui/date-picker';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@finnit/ui/components/ui/dialog';
import { Input } from '@finnit/ui/components/ui/input';

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
import type { DebtItem } from '@/lib/debts/view';
import { accountLabel } from '@/lib/finance/accounts';
import type { DayKey } from '@/lib/finance/dates';
import type { ApiAccount } from '@/lib/finance/types';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { accountOptions } from '@/lib/new-entry/options';

/**
 * Registers a payment: the movement that moved the money (a transfer to a
 * linked credit card, otherwise an expense) and the debt payment linked to
 * it. Mounted while open.
 */
export function PaymentDialog({
  item,
  accounts,
  categories,
  today,
  onClose,
  onSaved,
}: {
  item: DebtItem;
  accounts: ApiAccount[];
  categories: BudgetCategory[];
  today: DayKey;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocalizer();
  const tf = useTranslations('debts.payment');
  const locale = useLocale();
  const mode = React.useMemo(
    () => paymentMode(item.debt, accounts),
    [item.debt, accounts],
  );
  const sources = React.useMemo(
    () => paymentSources(mode, accounts),
    [mode, accounts],
  );
  const [form, setForm] = React.useState<PaymentForm>(() =>
    newPaymentForm(item.debt, {
      today,
      accountId: sources.length === 1 ? sources[0]!.id : '',
    }),
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
      remaining: item.debt.remainingBalance,
      today,
    });
    setErrors(found);
    const account = sources.find((a) => a.id === form.accountId);
    if (hasErrors(found) || !account) return;
    setSaving(true);
    setSubmitError(null);
    try {
      await registerDebtPayment(
        item.id,
        buildPaymentMovement(form, {
          debt: item.debt,
          mode,
          account,
          description: tf('movementDescription', { name: item.name }),
        }),
        gql,
      );
      onSaved();
    } catch (error) {
      setSubmitError(debtErrorMessage(error, t));
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent
        closeLabel={t('common.close')}
        className="max-h-[92dvh] overflow-y-auto sm:max-w-lg"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{tf('title')}</DialogTitle>
            <DialogDescription>
              {tf('description', { name: item.name, amount: item.remaining })}
            </DialogDescription>
          </DialogHeader>

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

          <Input
            label={tf('amount')}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => update({ amount: e.target.value })}
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
