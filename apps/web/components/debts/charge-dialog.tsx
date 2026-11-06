'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';

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
import { LendingMethodField } from './lending-method-field';
import { Input } from '@finnit/ui/components/ui/input';
import { NumberInput } from '@finnit/ui/components/ui/number-input';
import { MoneyInput } from '@finnit/ui/components/ui/money-input';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@finnit/ui/components/ui/toggle-group';

import { SwitchField } from '@/components/finance/switch-field';
import { SelectField } from '@/components/recurring/select-field';
import { budgetCategoryOptions } from '@finnit/core/budgets/options';
import type { BudgetCategory } from '@finnit/core/budgets/types';
import {
  addDebtCharge,
  debtErrorMessage,
  updateDebtCharge,
} from '@finnit/core/debts/api';
import {
  asksFirstPayment,
  asksPaidInstallments,
  chargeFormOf,
  chargePreview,
  addsToBalanceByDefault,
  newChargeForm,
  validateChargeForm,
  type ChargeErrorCode,
  type ChargeForm,
  type ChargeFormErrors,
} from '@finnit/core/debts/charge-form';
import { loanAccounts } from '@finnit/core/debts/detail-view';
import { hasErrors } from '@finnit/core/debts/form';
import {
  destinationOfMethod,
  type ApiDebt,
  type ApiDebtCharge,
} from '@finnit/core/debts/types';
import type { DayKey } from '@finnit/core/finance/dates';
import { DEFAULT_CURRENCY, formatMoney } from '@finnit/core/finance/money';
import type { ApiAccount } from '@finnit/core/finance/types';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { accountOptions } from '@finnit/core/new-entry/options';

/**
 * More money on a loan: another personal loan (it may be deposited into an
 * account, or bought in installments with the lender's card) or a purchase
 * financed on it, whose installments land on the loan's due dates. With
 * `charge` it edits that one. Mounted while open.
 */
export function ChargeDialog({
  debt,
  charge,
  accounts,
  categories,
  today,
  onClose,
  onSaved,
}: {
  debt: ApiDebt;
  /** The amount being edited; a new one when missing. */
  charge?: ApiDebtCharge;
  accounts: ApiAccount[];
  categories: BudgetCategory[];
  today: DayKey;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Closes with the exit animation before telling the parent.
  const exit = useDialogExit();
  const { t } = useLocalizer();
  const tf = useTranslations('debts.charge');
  const locale = useLocale();
  const purchase = debt.loanType === 'purchase_financing';
  const personal = debt.loanType === 'personal';
  const editing = Boolean(charge);
  const [form, setForm] = React.useState<ChargeForm>(() =>
    charge ? chargeFormOf(charge) : newChargeForm(debt, today),
  );
  const [errors, setErrors] = React.useState<ChargeFormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const accountItems = React.useMemo(
    () => accountOptions(loanAccounts(accounts)),
    [accounts],
  );
  const categoryItems = React.useMemo(
    () => budgetCategoryOptions(categories, locale),
    [categories, locale],
  );
  const preview = chargePreview(form, debt.paymentFrequency ?? 'monthly');
  const money = (n: number) => formatMoney(n, DEFAULT_CURRENCY, locale);
  const errorText = (code: ChargeErrorCode | undefined) =>
    code ? t(`debts.chargeValidation.${code}`) : undefined;

  // Until the user decides, old money starts off the balance (spent).
  const balanceChosen = React.useRef(editing);

  function update(patch: Partial<ChargeForm>) {
    if (patch.depositAddsToBalance !== undefined) balanceChosen.current = true;
    else if (patch.date !== undefined && !balanceChosen.current)
      patch = {
        ...patch,
        depositAddsToBalance: addsToBalanceByDefault(patch.date, today),
      };
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch))
        delete next[key as keyof ChargeForm];
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateChargeForm(form, {
      today,
      needsInstallments: purchase,
    });
    setErrors(found);
    if (hasErrors(found)) return;
    setSaving(true);
    setSubmitError(null);
    try {
      if (charge) await updateDebtCharge(form, charge.id, gql);
      else await addDebtCharge(form, debt.id, gql);
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
            <DialogTitle>
              {editing
                ? tf(purchase ? 'editPurchaseTitle' : 'editTitle')
                : tf(purchase ? 'purchaseTitle' : 'title')}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? tf('editDescription', { name: debt.name })
                : purchase
                  ? tf('purchaseDescription', { name: debt.name })
                  : tf('description', { name: debt.name })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <Input
              label={tf('descriptionLabel')}
              value={form.description}
              maxLength={200}
              autoComplete="off"
              placeholder={
                purchase ? tf('purchasePlaceholder') : tf('placeholder')
              }
              onChange={(e) => update({ description: e.target.value })}
            />
            <div className="flex flex-col gap-1">
              <Combobox
                label={tf('purpose')}
                options={categoryItems}
                value={form.purposeCategoryId || undefined}
                onChange={(purposeCategoryId) =>
                  update({ purposeCategoryId: purposeCategoryId ?? '' })
                }
                placeholder={tf('purposePlaceholder')}
                searchPlaceholder={tf('purposeSearch')}
                emptyText={tf('noResults')}
                clearable
              />
              <p className="px-1 text-xs text-on-surface-variant">
                {tf('purposeHint')}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyInput
                label={purchase ? tf('purchaseAmount') : tf('amount')}
                value={form.principal}
                onValueChange={(value) => update({ principal: value })}
                error={errorText(errors.principal)}
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberInput
                maxDigits={4}
                label={
                  purchase ? tf('installments') : tf('installmentsOptional')
                }
                placeholder={tf('installmentsPlaceholder')}
                value={form.installments}
                onValueChange={(value) => update({ installments: value })}
                error={errorText(errors.installments)}
              />
              {form.installments.trim() ? (
                <SelectField
                  label={tf('interest')}
                  value={form.interest}
                  options={[
                    { value: 'total', label: tf('interestTotal') },
                    { value: 'rate', label: tf('interestRate') },
                  ]}
                  onChange={(interest) => update({ interest })}
                />
              ) : null}
            </div>

            {asksPaidInstallments(debt, form) ? (
              <div className="flex flex-col gap-1">
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberInput
                    maxDigits={4}
                    label={tf('installmentsPaid')}
                    placeholder={tf('installmentsPaidPlaceholder')}
                    value={form.installmentsPaid}
                    onValueChange={(value) =>
                      update({ installmentsPaid: value })
                    }
                    error={errorText(errors.installmentsPaid)}
                  />
                </div>
                <p className="px-1 text-xs text-on-surface-variant">
                  {tf('installmentsPaidHint')}
                </p>
              </div>
            ) : null}

            {personal && !form.installments.trim() ? (
              <p className="-mt-2 px-1 text-xs text-on-surface-variant">
                {tf('installmentsHintPersonal')}
              </p>
            ) : null}

            {asksFirstPayment(debt, form) ? (
              <div className="flex flex-col gap-1">
                <DatePicker
                  label={tf('firstPayment')}
                  value={form.firstPaymentDate || undefined}
                  onChange={(day) => update({ firstPaymentDate: day ?? '' })}
                  locale={locale}
                  placeholder={tf('datePlaceholder')}
                  clearable
                  clearLabel={t('debts.detail.clearDate')}
                  error={errorText(errors.firstPaymentDate)}
                />
                <p className="px-1 text-xs text-on-surface-variant">
                  {tf(
                    personal && !debt.recurringExpenseId
                      ? 'firstPaymentHint'
                      : 'firstPaymentHintScheduled',
                  )}
                </p>
              </div>
            ) : null}

            {form.interest === 'rate' && form.installments.trim() ? (
              <div className="flex flex-col gap-3">
                <NumberInput
                  decimals={4}
                  suffix="%"
                  label={tf('rate')}
                  placeholder={tf('ratePlaceholder')}
                  value={form.rate}
                  onValueChange={(value) => update({ rate: value })}
                  error={errorText(errors.rate)}
                />
                <p className="-mt-2 px-1 text-xs text-on-surface-variant">
                  {t('debts.loan.rateHint')}
                </p>
                <SwitchField
                  label={tf('vat')}
                  checked={form.includesVat}
                  onCheckedChange={(includesVat) => update({ includesVat })}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <MoneyInput
                  label={tf('totalToRepay')}
                  placeholder={tf('totalPlaceholder')}
                  value={form.totalToRepay}
                  onValueChange={(value) => update({ totalToRepay: value })}
                  error={errorText(errors.totalToRepay)}
                />
                <p className="px-1 text-xs text-on-surface-variant">
                  {tf('totalHint')}
                </p>
              </div>
            )}

            {preview ? (
              <p
                aria-live="polite"
                className="rounded-input bg-income/10 p-3 text-sm text-on-background"
              >
                {tf('preview', {
                  count: Number(form.installments),
                  amount: money(preview.installmentAmount),
                  total: money(preview.totalToRepay),
                })}
              </p>
            ) : null}

            {personal ? (
              <LendingMethodField
                value={form.lendingMethod}
                onChange={(lendingMethod) =>
                  update({
                    lendingMethod,
                    ...(lendingMethod && {
                      destination: destinationOfMethod(lendingMethod),
                    }),
                  })
                }
              />
            ) : null}
            <div className="flex flex-col gap-2">
              <ToggleGroup
                type="single"
                value={form.destination}
                onValueChange={(value) =>
                  value &&
                  update({ destination: value as ChargeForm['destination'] })
                }
                className="flex-wrap"
              >
                <ToggleGroupItem value="deposit">
                  {t('debts.destinations.deposit')}
                </ToggleGroupItem>
                <ToggleGroupItem value="purchase">
                  {t('debts.destinations.purchase')}
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="px-1 text-xs text-on-surface-variant">
                {t(`debts.destinationHints.${form.destination}`)}
              </p>
            </div>
            {form.destination === 'deposit' ? (
              <SwitchField
                label={t('debts.loan.addsToBalance')}
                hint={t('debts.loan.addsToBalanceHint')}
                checked={form.depositAddsToBalance}
                onCheckedChange={(depositAddsToBalance) =>
                  update({ depositAddsToBalance })
                }
              />
            ) : null}
            {form.destination === 'deposit' && form.depositAddsToBalance ? (
              <>
                <Combobox
                  label={tf('depositAccount')}
                  options={accountItems}
                  value={form.depositAccountId || undefined}
                  onChange={(depositAccountId) =>
                    update({ depositAccountId: depositAccountId ?? '' })
                  }
                  placeholder={tf('accountPlaceholder')}
                  searchPlaceholder={tf('accountSearch')}
                  emptyText={tf('noResults')}
                  error={errorText(errors.depositAccountId)}
                />
                <SwitchField
                  label={t('debts.loan.countsAsIncome')}
                  hint={t('debts.loan.countsAsIncomeHint')}
                  checked={form.depositCountsAsIncome}
                  onCheckedChange={(depositCountsAsIncome) =>
                    update({ depositCountsAsIncome })
                  }
                />
              </>
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
            <Button type="submit" variant="secondary" disabled={saving}>
              {saving ? tf('saving') : editing ? tf('save') : tf('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
