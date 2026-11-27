import * as React from 'react';
import { useTranslations } from 'use-intl';

import { budgetCategoryOptions } from '@finnit/core/budgets/options';
import type { BudgetCategory } from '@finnit/core/budgets/types';
import { debtErrorMessage, updateLoan } from '@finnit/core/debts/api';
import { buildLoanUpdate, loanEditFields, loanEditFormOf, validateLoanEdit, type LoanEditErrorCode, type LoanEditForm } from '@finnit/core/debts/loan-edit';
import { hasErrors } from '@finnit/core/debts/form';
import type { ApiDebt } from '@finnit/core/debts/types';
import type { DayKey } from '@finnit/core/finance/dates';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { DatePicker } from '@finnit/ui-native/components/ui/date-picker';
import { Input } from '@finnit/ui-native/components/ui/input';
import { MoneyInput } from '@finnit/ui-native/components/ui/money-input';
import { NumberInput } from '@finnit/ui-native/components/ui/number-input';
import { Select } from '@finnit/ui-native/components/ui/select';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Switch } from '@finnit/ui-native/components/ui/switch';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { ContactSelect } from './contact-select';

/**
 * Edits a loan's details (the web's details tab in edit mode). Purchase
 * financing and personal loans: only the loan's own data (name, lender);
 * their amounts are edited purchase by purchase. Others: also the amount,
 * number of payments, date, fees (the API recomputes the terms), what it
 * was for, and whether its deposit still counts in the account.
 */
export function LoanEditSheet({
  debt,
  categories,
  today,
  onClose,
  onSaved,
}: {
  debt: ApiDebt;
  /** For "¿En qué se usó?" (informative). */
  categories: BudgetCategory[];
  today: DayKey;
  onClose: () => void;
  onSaved: (changed: boolean) => void;
}) {
  const td = useTranslations('debts.detail');
  const { t, locale } = useLocalizer();
  const gql = useGql();
  const fields = loanEditFields(debt);
  const [form, setForm] = React.useState<LoanEditForm>(() => loanEditFormOf(debt));
  const [errors, setErrors] = React.useState<ReturnType<typeof validateLoanEdit>>({});
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const categoryItems = React.useMemo(
    () =>
      budgetCategoryOptions(categories, locale).map((o) => ({
        value: o.value,
        label: o.label,
        hint: o.group && o.group !== o.label ? o.group : undefined,
      })),
    [categories, locale],
  );
  const errorText = (code: LoanEditErrorCode | undefined) => (code ? t(`debts.loanEditValidation.${code}`) : undefined);
  const update = (patch: Partial<LoanEditForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setErrors({});
  };

  async function save() {
    const found = validateLoanEdit(form, debt, { today });
    setErrors(found);
    if (hasErrors(found)) return;
    const input = buildLoanUpdate(form, debt);
    if (!input) {
      onSaved(false);
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      await updateLoan(debt.id, input, gql);
      onSaved(true);
    } catch (error) {
      setSubmitError(debtErrorMessage(error, t));
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && !saving && onClose()}
      title={td('editTitle')}
      closeLabel={t('common.close')}
      footer={<Button label={saving ? td('saving') : td('save')} onPress={() => void save()} disabled={saving} className="w-full" />}
    >
      <TwView className="gap-4 pb-2">
        <Input label={td('facts.name')} value={form.name} onChangeText={(name) => update({ name })} error={errorText(errors.name)} />
        {debt.loanType === 'personal' ? (
          <ContactSelect
            label={td('facts.lenderPerson')}
            value={form.lenderContactId}
            name={form.lenderName}
            onChange={(contact) => update({ lenderContactId: contact?.id ?? '', lenderName: contact?.name ?? '' })}
          />
        ) : (
          <Input label={td('facts.lender')} value={form.lenderName} maxLength={120} onChangeText={(lenderName) => update({ lenderName })} />
        )}
        {fields.terms ? (
          <MoneyInput label={td('facts.principal')} value={form.principal} onValueChange={(principal) => update({ principal })} error={errorText(errors.principal)} />
        ) : null}
        {fields.installments ? (
          <NumberInput
            label={td('facts.installments')}
            maxDigits={4}
            value={form.installments}
            onValueChange={(installments) => update({ installments })}
            error={errorText(errors.installments)}
          />
        ) : null}
        {fields.terms ? (
          <DatePicker
            label={td('startDateOptional')}
            value={form.startDate || undefined}
            onChange={(startDate) => update({ startDate: startDate ?? '' })}
            max={today}
            locale={locale}
            clearable
            clearLabel={td('clearDate')}
            error={errorText(errors.startDate)}
            closeLabel={t('common.close')}
          />
        ) : null}
        {fields.openingFee ? (
          <MoneyInput label={td('facts.openingFee')} value={form.openingFee} onValueChange={(openingFee) => update({ openingFee })} error={errorText(errors.openingFee)} />
        ) : null}
        {fields.periodicFee ? (
          <MoneyInput label={td('facts.periodicFee')} value={form.periodicFee} onValueChange={(periodicFee) => update({ periodicFee })} error={errorText(errors.periodicFee)} />
        ) : null}
        {fields.terms ? (
          <Select
            label={td('facts.purpose')}
            title={td('facts.purpose')}
            options={categoryItems}
            value={form.purposeCategoryId || null}
            onValueChange={(purposeCategoryId) => update({ purposeCategoryId })}
            placeholder={td('purposePlaceholder')}
            searchable
            searchPlaceholder={td('purposeSearch')}
            emptyLabel={td('noResults')}
            closeLabel={t('common.close')}
          />
        ) : null}
        {/* Money already spent: turning it off removes the deposit (it can't come back on). */}
        {fields.terms && debt.destination === 'deposit' && debt.depositAddsToBalance ? (
          <TwView className="flex-row items-center gap-3">
            <TwView className="min-w-0 flex-1">
              <Text className="text-sm">{t('debts.loan.addsToBalance')}</Text>
              <Text className="text-xs text-on-surface-variant">{td('removeDepositHint')}</Text>
            </TwView>
            <Switch
              checked={form.depositAddsToBalance}
              onCheckedChange={(depositAddsToBalance) => update({ depositAddsToBalance })}
              accessibilityLabel={t('debts.loan.addsToBalance')}
            />
          </TwView>
        ) : null}
        {fields.terms ? <Text className="text-xs text-on-surface-variant">{td('editHint')}</Text> : null}
        {submitError ? (
          <Text accessibilityRole="alert" className="text-[13px] text-expense">
            {submitError}
          </Text>
        ) : null}
      </TwView>
    </Sheet>
  );
}
