import * as React from 'react';
import { useTranslations } from 'use-intl';

import {
  NAME_MAX,
  type DebtErrorCode,
  type DebtForm,
  type DebtFormErrors,
} from '@finnit/core/debts/form';
import type { ApiAccount } from '@finnit/core/finance/types';
import { accountOptions } from '@finnit/core/new-entry/options';
import { TwView } from '@finnit/ui-native/lib/tw';
import { DatePicker } from '@finnit/ui-native/components/ui/date-picker';
import { Input } from '@finnit/ui-native/components/ui/input';
import { MoneyInput } from '@finnit/ui-native/components/ui/money-input';
import { NumberInput } from '@finnit/ui-native/components/ui/number-input';
import { Select } from '@finnit/ui-native/components/ui/select';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useLocalizer } from '@/lib/i18n/i18n-provider';

/** The web's OtherDebtFields: any other debt (amount, rate, minimum, dates, account). */
export function OtherDebtFields({
  form,
  errors,
  update,
  accounts,
}: {
  form: DebtForm;
  errors: DebtFormErrors;
  update: (patch: Partial<DebtForm>) => void;
  accounts: ApiAccount[];
}) {
  const { t, locale } = useLocalizer();
  const tf = useTranslations('debts.form');
  const accountItems = React.useMemo(
    () =>
      accountOptions(accounts).map(({ value, label }) => ({ value, label })),
    [accounts],
  );
  const errorText = (code: DebtErrorCode | undefined) =>
    code ? t(`debts.validation.${code}`) : undefined;

  return (
    <TwView className="gap-4">
      <Input
        label={tf('name')}
        value={form.name}
        maxLength={NAME_MAX}
        placeholder={tf('namePlaceholder')}
        onChangeText={(name) => update({ name })}
        error={errorText(errors.name)}
      />
      <TwView className="gap-1">
        <MoneyInput
          label={tf('principal')}
          value={form.principal}
          onValueChange={(principal) => update({ principal })}
          error={errorText(errors.principal)}
        />
        <Text className="px-1 text-xs text-on-surface-variant">
          {tf('principalHint')}
        </Text>
      </TwView>
      <NumberInput
        decimals={4}
        suffix="%"
        label={tf('rate')}
        placeholder={tf('ratePlaceholder')}
        value={form.rate}
        onValueChange={(rate) => update({ rate })}
        error={errorText(errors.rate)}
      />
      <MoneyInput
        label={tf('minPayment')}
        value={form.minPayment}
        onValueChange={(minPayment) => update({ minPayment })}
        error={errorText(errors.minPayment)}
      />
      <DatePicker
        label={tf('startDate')}
        value={form.startDate || undefined}
        onChange={(day) => update({ startDate: day ?? '' })}
        locale={locale}
        clearable
        clearLabel={tf('clearDate')}
        closeLabel={t('common.close')}
      />
      <DatePicker
        label={tf('dueDate')}
        value={form.dueDate || undefined}
        onChange={(day) => update({ dueDate: day ?? '' })}
        min={form.startDate || undefined}
        locale={locale}
        clearable
        clearLabel={tf('clearDate')}
        error={errorText(errors.dueDate)}
        closeLabel={t('common.close')}
      />
      <TwView className="gap-1">
        <Select
          label={tf('account')}
          options={accountItems}
          value={form.linkedAccountId || null}
          onValueChange={(linkedAccountId) => update({ linkedAccountId })}
          placeholder={tf('accountPlaceholder')}
          closeLabel={t('common.close')}
        />
        <Text className="px-1 text-xs text-on-surface-variant">
          {tf('accountHint')}
        </Text>
      </TwView>
    </TwView>
  );
}
