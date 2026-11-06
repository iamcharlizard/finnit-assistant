'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Pencil } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Combobox } from '@finnit/ui/components/ui/combobox';
import { DatePicker } from '@finnit/ui/components/ui/date-picker';
import { Input } from '@finnit/ui/components/ui/input';
import { MoneyInput } from '@finnit/ui/components/ui/money-input';
import { NumberInput } from '@finnit/ui/components/ui/number-input';
import { toast } from '@finnit/ui/components/ui/toaster';

import { ContactCombobox } from '@/components/contacts/contact-combobox';
import { SwitchField } from '@/components/finance/switch-field';
import { LendingMethodField } from './lending-method-field';
import { budgetCategoryOptions } from '@finnit/core/budgets/options';
import type { BudgetCategory } from '@finnit/core/budgets/types';
import { debtErrorMessage, updateLoan } from '@finnit/core/debts/api';
import type { DetailFact } from '@finnit/core/debts/detail-view';
import { hasErrors } from '@finnit/core/debts/form';
import { DESCRIPTION_MAX, hasDescription } from '@finnit/core/debts/loan-form';
import {
  buildLoanUpdate,
  loanEditFields,
  loanEditFormOf,
  validateLoanEdit,
  type LoanEditErrorCode,
  type LoanEditErrors,
  type LoanEditForm,
} from '@finnit/core/debts/loan-edit';
import type { ApiDebtDetail } from '@finnit/core/debts/types';
import type { DayKey } from '@finnit/core/finance/dates';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

/**
 * What defines the loan. Read mode lists it; edit mode changes the name,
 * lender, amount, number of payments, date, fees and what it was for (the
 * API recomputes the payments when the terms change).
 */
export function LoanDetailsTab({
  debt,
  facts,
  categories,
  today,
  onSaved,
}: {
  debt: ApiDebtDetail;
  facts: DetailFact[];
  categories: BudgetCategory[];
  today: DayKey;
  onSaved: () => void;
}) {
  const { t, locale } = useLocalizer();
  const td = useTranslations('debts.detail');
  const [form, setForm] = React.useState<LoanEditForm | null>(null);
  const [errors, setErrors] = React.useState<LoanEditErrors>({});
  const [saving, setSaving] = React.useState(false);
  const fields = loanEditFields(debt);
  const categoryItems = React.useMemo(
    () => budgetCategoryOptions(categories, locale),
    [categories, locale],
  );
  const errorText = (code: LoanEditErrorCode | undefined) =>
    code ? t(`debts.loanEditValidation.${code}`) : undefined;

  function update(patch: Partial<LoanEditForm>) {
    setForm((current) => (current ? { ...current, ...patch } : current));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch))
        delete next[key as keyof LoanEditForm];
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    const found = validateLoanEdit(form, debt, { today });
    setErrors(found);
    if (hasErrors(found)) return;
    const input = buildLoanUpdate(form, debt);
    if (!input) {
      setForm(null);
      return;
    }
    setSaving(true);
    try {
      await updateLoan(debt.id, input, gql);
      toast.success(td('detailsSaved'));
      setForm(null);
      onSaved();
    } catch (error) {
      toast.error(debtErrorMessage(error, t));
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return (
      <section
        aria-labelledby="loan-details"
        className="flex flex-col gap-3 rounded-card border border-outline bg-surface p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="loan-details"
            className="text-lg font-bold text-on-background"
          >
            {td('detailsTitle')}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setErrors({});
              setForm(loanEditFormOf(debt));
            }}
          >
            <Pencil aria-hidden /> {td('edit')}
          </Button>
        </div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.key} className="flex flex-col gap-0.5">
              <dt className="text-xs text-on-surface-variant">{fact.label}</dt>
              <dd className="text-sm font-medium text-on-background tabular-nums">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  return (
    <form
      onSubmit={submit}
      aria-labelledby="loan-details-edit"
      className="flex flex-col gap-4 rounded-card border border-outline bg-surface p-4"
    >
      <h2
        id="loan-details-edit"
        className="text-lg font-bold text-on-background"
      >
        {td('editTitle')}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={td('facts.name')}
          value={form.name}
          maxLength={100}
          autoComplete="off"
          onChange={(e) => update({ name: e.target.value })}
          error={errorText(errors.name)}
        />
        {hasDescription(debt.loanType) ? (
          <Input
            label={t(`debts.loan.description.${debt.loanType!}`)}
            value={form.description}
            maxLength={DESCRIPTION_MAX}
            autoComplete="off"
            onChange={(e) => update({ description: e.target.value })}
          />
        ) : null}
        {debt.loanType === 'personal' ? (
          <ContactCombobox
            label={td('facts.lenderPerson')}
            value={form.lenderContactId}
            name={form.lenderName}
            onChange={(contact) =>
              update({
                lenderContactId: contact?.id ?? '',
                lenderName: contact?.name ?? '',
              })
            }
          />
        ) : (
          <Input
            label={td('facts.lender')}
            value={form.lenderName}
            maxLength={120}
            autoComplete="off"
            onChange={(e) => update({ lenderName: e.target.value })}
          />
        )}
        <MoneyInput
          label={td('facts.principal')}
          value={form.principal}
          onValueChange={(principal) => update({ principal })}
          error={errorText(errors.principal)}
        />
        {fields.installments ? (
          <NumberInput
            label={td('facts.installments')}
            maxDigits={4}
            value={form.installments}
            onValueChange={(installments) => update({ installments })}
            error={errorText(errors.installments)}
          />
        ) : null}
        <DatePicker
          label={td('startDateOptional')}
          value={form.startDate || undefined}
          onChange={(startDate) => update({ startDate: startDate ?? '' })}
          max={today}
          locale={locale}
          placeholder={td('datePlaceholder')}
          clearable
          clearLabel={td('clearDate')}
          error={errorText(errors.startDate)}
        />
        {debt.loanType === 'personal' ? (
          <LendingMethodField
            value={form.lendingMethod}
            onChange={(lendingMethod) => update({ lendingMethod })}
          />
        ) : null}
        {fields.openingFee ? (
          <MoneyInput
            label={td('facts.openingFee')}
            value={form.openingFee}
            onValueChange={(openingFee) => update({ openingFee })}
            error={errorText(errors.openingFee)}
          />
        ) : null}
        {fields.periodicFee ? (
          <MoneyInput
            label={td('facts.periodicFee')}
            value={form.periodicFee}
            onValueChange={(periodicFee) => update({ periodicFee })}
            error={errorText(errors.periodicFee)}
          />
        ) : null}
        <Combobox
          label={td('facts.purpose')}
          options={categoryItems}
          value={form.purposeCategoryId || undefined}
          onChange={(purposeCategoryId) =>
            update({ purposeCategoryId: purposeCategoryId ?? '' })
          }
          placeholder={td('purposePlaceholder')}
          searchPlaceholder={td('purposeSearch')}
          emptyText={td('noResults')}
          clearable
        />
      </div>
      {debt.destination === 'deposit' && debt.depositAddsToBalance ? (
        <SwitchField
          label={t('debts.loan.addsToBalance')}
          hint={t('debts.detail.removeDepositHint')}
          checked={form.depositAddsToBalance}
          onCheckedChange={(depositAddsToBalance) =>
            update({ depositAddsToBalance })
          }
        />
      ) : null}
      <p className="px-1 text-xs text-on-surface-variant">{td('editHint')}</p>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={saving}
          onClick={() => setForm(null)}
        >
          {td('cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? td('saving') : td('save')}
        </Button>
      </div>
    </form>
  );
}
