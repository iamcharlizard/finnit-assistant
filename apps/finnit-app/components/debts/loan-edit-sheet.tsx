import * as React from 'react';
import { useTranslations } from 'use-intl';

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
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { ContactSelect } from './contact-select';

/**
 * Edits a loan's details (the web's details tab in edit mode). Purchase
 * financing and personal loans: only the loan's own data (name, lender);
 * their amounts are edited purchase by purchase. Others: also the amount,
 * number of payments, date and fees (the API recomputes the terms).
 */
export function LoanEditSheet({
  debt,
  today,
  onClose,
  onSaved,
}: {
  debt: ApiDebt;
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
