import * as React from 'react';
import { useTranslations } from 'use-intl';
import { Plus, Trash2 } from 'lucide-react-native';

import {
  DESCRIPTION_MAX,
  depositMismatch,
  hasDescription,
  isFixedTerm,
  loanPreview,
  newHistoricalRow,
  startsEmpty,
  type HistoricalRow,
  type LoanErrorCode,
  type LoanForm,
  type LoanFormErrors,
} from '@finnit/core/debts/loan-form';
import { NAME_MAX } from '@finnit/core/debts/form';
import { loanAccounts } from '@finnit/core/debts/detail-view';
import {
  LOAN_FREQUENCIES,
  LOAN_INTEREST_MODES,
} from '@finnit/core/debts/types';
import type { DayKey } from '@finnit/core/finance/dates';
import { DEFAULT_CURRENCY, formatMoney } from '@finnit/core/finance/money';
import type { ApiAccount } from '@finnit/core/finance/types';
import { accountOptions } from '@finnit/core/new-entry/options';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { DatePicker } from '@finnit/ui-native/components/ui/date-picker';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Input } from '@finnit/ui-native/components/ui/input';
import { MoneyInput } from '@finnit/ui-native/components/ui/money-input';
import { NumberInput } from '@finnit/ui-native/components/ui/number-input';
import { Select } from '@finnit/ui-native/components/ui/select';
import { Switch } from '@finnit/ui-native/components/ui/switch';
import { Text } from '@finnit/ui-native/components/ui/text';
import { ToggleGroup } from '@finnit/ui-native/components/ui/toggle-group';

import { useLocalizer } from '@/lib/i18n/i18n-provider';

function SwitchRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <TwView className="flex-row items-center gap-3">
      <TwView className="flex-1 gap-0.5">
        <Text className="text-sm">{label}</Text>
        {hint ? (
          <Text className="text-xs text-on-surface-variant">{hint}</Text>
        ) : null}
      </TwView>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        accessibilityLabel={label}
      />
    </TwView>
  );
}

/**
 * The loan part of "Nueva deuda" (the web's loan fields): lender, amount,
 * date, how it is paid, payments already made, where the money went and
 * the account that pays it. Fees per payment, an edited deposit amount,
 * what the money was for and the payment category stay web-only.
 */
export function LoanFields({
  form,
  errors,
  update,
  accounts,
  today,
}: {
  form: LoanForm;
  errors: LoanFormErrors;
  update: (patch: Partial<LoanForm>) => void;
  accounts: ApiAccount[];
  today: DayKey;
}) {
  const l = useLocalizer();
  const { t, locale } = l;
  const tf = useTranslations('debts.loan');
  const money = (n: number) => formatMoney(n, DEFAULT_CURRENCY, locale);
  const accountItems = React.useMemo(
    () =>
      accountOptions(loanAccounts(accounts)).map(({ value, label }) => ({
        value,
        label,
      })),
    [accounts],
  );
  const errorText = (code: LoanErrorCode | undefined) =>
    code ? t(`debts.loanValidation.${code}`) : undefined;
  const fixed = isFixedTerm(form.loanType);
  const scheduled = fixed || form.hasSchedule;
  const preview = loanPreview(form);
  const mismatch = depositMismatch(form);
  const frequencies = LOAN_FREQUENCIES.map((f) => ({
    value: f,
    label: t(`debts.loanFrequencies.${f}`),
  }));

  function updateRow(key: string, patch: Partial<HistoricalRow>) {
    update({
      historical: form.historical.map((row) =>
        row.key === key ? { ...row, ...patch } : row,
      ),
    });
  }

  return (
    <TwView className="gap-4">
      <Input
        label={tf('name')}
        value={form.name}
        maxLength={NAME_MAX}
        placeholder={tf(`namePlaceholder.${form.loanType}`)}
        onChangeText={(name) => update({ name })}
        error={errorText(errors.name)}
      />
      <Input
        label={tf(`lender.${form.loanType}`)}
        value={form.lenderName}
        maxLength={NAME_MAX}
        onChangeText={(lenderName) =>
          update({ lenderName, lenderContactId: '' })
        }
      />
      {hasDescription(form.loanType) ? (
        <Input
          label={tf(`description.${form.loanType}`)}
          value={form.description}
          maxLength={DESCRIPTION_MAX}
          placeholder={tf(`descriptionPlaceholder.${form.loanType}`)}
          onChangeText={(description) => update({ description })}
        />
      ) : null}
      <TwView className="gap-1">
        <MoneyInput
          label={tf(`principal.${form.loanType}`)}
          value={form.principal}
          onValueChange={(principal) => update({ principal })}
          error={errorText(errors.principal)}
        />
        {form.loanType === 'personal' ? (
          <Text className="px-1 text-xs text-on-surface-variant">
            {tf('principalPersonalHint')}
          </Text>
        ) : null}
      </TwView>
      <DatePicker
        label={tf(`startDate.${form.loanType}`)}
        value={form.startDate || undefined}
        onChange={(day) => update({ startDate: day ?? '' })}
        max={today}
        locale={locale}
        clearable
        clearLabel={tf('clearDate')}
        error={errorText(errors.startDate)}
        closeLabel={t('common.close')}
      />
      {form.loanType === 'institutional' ? (
        <TwView className="gap-1">
          <MoneyInput
            label={tf('openingFee')}
            value={form.openingFee}
            onValueChange={(openingFee) => update({ openingFee })}
            error={
              mismatch
                ? t('debts.loanValidation.depositMismatch', {
                    expected: money(mismatch.expected),
                    typed: money(mismatch.typed),
                  })
                : errorText(errors.openingFee)
            }
          />
          <Text className="px-1 text-xs text-on-surface-variant">
            {tf('openingFeeHint')}
          </Text>
        </TwView>
      ) : null}

      <TwView className="gap-4 rounded-3xl border border-outline p-4">
        <Text weight="bold" className="text-sm">
          {tf('termsTitle')}
        </Text>
        {fixed ? (
          <>
            <NumberInput
              maxDigits={4}
              label={tf('installments')}
              placeholder={tf('installmentsPlaceholder')}
              value={form.installments}
              onValueChange={(installments) => update({ installments })}
              error={errorText(errors.installments)}
            />
            <Select
              label={tf('frequency')}
              options={frequencies}
              value={form.frequency}
              onValueChange={(frequency) => update({ frequency })}
              closeLabel={t('common.close')}
            />
            <Select
              label={tf('interestMode')}
              options={LOAN_INTEREST_MODES.map((mode) => ({
                value: mode,
                label: t(`debts.interestModes.${mode}`),
                hint: t(`debts.interestModeHints.${mode}`),
              }))}
              value={form.interestMode}
              onValueChange={(interestMode) => update({ interestMode })}
              closeLabel={t('common.close')}
            />
            {form.interestMode === 'rate' ? (
              <>
                <NumberInput
                  decimals={4}
                  suffix="%"
                  label={tf('rate')}
                  placeholder={tf('ratePlaceholder')}
                  value={form.rate}
                  onValueChange={(rate) => update({ rate })}
                  error={errorText(errors.rate)}
                />
                <SwitchRow
                  label={tf('vat')}
                  hint={tf('vatHint')}
                  checked={form.includesVat}
                  onCheckedChange={(includesVat) => update({ includesVat })}
                />
              </>
            ) : null}
            {form.interestMode === 'total_amount' ? (
              <MoneyInput
                label={tf('totalToRepay')}
                value={form.totalToRepay}
                onValueChange={(totalToRepay) => update({ totalToRepay })}
                error={errorText(errors.totalToRepay)}
              />
            ) : null}
            {form.interestMode === 'installment_amount' ? (
              <MoneyInput
                label={tf('installmentAmount')}
                value={form.installmentAmount}
                onValueChange={(installmentAmount) =>
                  update({ installmentAmount })
                }
                error={errorText(errors.installmentAmount)}
              />
            ) : null}
          </>
        ) : (
          <>
            <MoneyInput
              label={tf('personalTotal')}
              placeholder={tf('personalTotalPlaceholder')}
              value={form.totalToRepay}
              onValueChange={(totalToRepay) => update({ totalToRepay })}
              error={errorText(errors.totalToRepay)}
            />
            <SwitchRow
              label={tf('hasSchedule')}
              hint={tf('hasScheduleHint')}
              checked={form.hasSchedule}
              onCheckedChange={(hasSchedule) => update({ hasSchedule })}
            />
            {form.hasSchedule ? (
              <>
                <MoneyInput
                  label={tf('agreedPayment')}
                  value={form.installmentAmount}
                  onValueChange={(installmentAmount) =>
                    update({ installmentAmount })
                  }
                  error={errorText(errors.installmentAmount)}
                />
                <Select
                  label={tf('frequency')}
                  options={frequencies}
                  value={form.frequency}
                  onValueChange={(frequency) => update({ frequency })}
                  closeLabel={t('common.close')}
                />
              </>
            ) : null}
          </>
        )}
        {scheduled ? (
          <DatePicker
            label={tf('firstPaymentDate')}
            value={form.firstPaymentDate || undefined}
            onChange={(day) => update({ firstPaymentDate: day ?? '' })}
            locale={locale}
            error={errorText(errors.firstPaymentDate)}
            closeLabel={t('common.close')}
          />
        ) : null}
        {preview && fixed ? (
          <Text
            accessibilityLiveRegion="polite"
            className="rounded-2xl bg-income-10 p-3 text-sm"
          >
            {tf('preview', {
              count: Number(form.installments),
              amount: money(preview.installmentAmount),
              total: money(preview.totalToRepay),
              interest: money(Math.max(0, preview.interest)),
            })}
          </Text>
        ) : null}
      </TwView>

      <TwView className="gap-3 rounded-3xl border border-outline p-4">
        <Text weight="bold" className="text-sm">
          {tf('paidTitle')}
        </Text>
        <Text className="text-xs text-on-surface-variant">
          {tf('paidHint')}
        </Text>
        {fixed ? (
          <NumberInput
            maxDigits={4}
            label={tf('installmentsPaid')}
            placeholder="0"
            value={form.installmentsPaid}
            onValueChange={(installmentsPaid) => update({ installmentsPaid })}
            error={errorText(errors.installmentsPaid)}
          />
        ) : (
          <>
            {form.historical.map((row, index) => (
              <TwView key={row.key} className="gap-2 rounded-2xl bg-track p-3">
                <TwView className="flex-row items-center justify-between">
                  <Text weight="medium" className="text-sm">
                    #{index + 1}
                  </Text>
                  <TwPressable
                    accessibilityRole="button"
                    accessibilityLabel={tf('removeHistorical', {
                      number: index + 1,
                    })}
                    onPress={() =>
                      update({
                        historical: form.historical.filter(
                          (r) => r.key !== row.key,
                        ),
                      })
                    }
                    className="size-11 items-center justify-center rounded-full active:bg-accent"
                  >
                    <Icon icon={Trash2} size={18} color="--expense" />
                  </TwPressable>
                </TwView>
                <MoneyInput
                  label={tf('historicalAmount')}
                  value={row.amount}
                  onValueChange={(amount) => updateRow(row.key, { amount })}
                />
                <DatePicker
                  label={tf('historicalDate')}
                  value={row.date || undefined}
                  onChange={(day) => updateRow(row.key, { date: day ?? '' })}
                  max={today}
                  locale={locale}
                  closeLabel={t('common.close')}
                />
                <Select
                  label={tf('historicalAccount')}
                  options={accountItems}
                  value={row.accountId || null}
                  onValueChange={(accountId) =>
                    updateRow(row.key, { accountId })
                  }
                  placeholder={tf('historicalAccountPlaceholder')}
                  closeLabel={t('common.close')}
                />
              </TwView>
            ))}
            {errors.historical ? (
              <Text className="text-[13px] text-expense">
                {errorText(errors.historical)}
              </Text>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              icon={Plus}
              label={tf('addHistorical')}
              onPress={() =>
                update({
                  historical: [...form.historical, newHistoricalRow(today)],
                })
              }
            />
          </>
        )}
      </TwView>

      {startsEmpty(form) ? null : (
        <TwView className="gap-3 rounded-3xl border border-outline p-4">
          <Text weight="bold" className="text-sm">
            {tf('destinationTitle')}
          </Text>
          <ToggleGroup
            accessibilityLabel={tf('destinationTitle')}
            value={form.destination}
            options={[
              { value: 'deposit', label: t('debts.destinations.deposit') },
              { value: 'purchase', label: t('debts.destinations.purchase') },
            ]}
            onValueChange={(destination) => update({ destination })}
          />
          <Text className="px-1 text-xs text-on-surface-variant">
            {t(`debts.destinationHints.${form.destination}`)}
          </Text>
          {form.destination === 'deposit' ? (
            <SwitchRow
              label={tf('addsToBalance')}
              hint={tf('addsToBalanceHint')}
              checked={form.depositAddsToBalance}
              onCheckedChange={(depositAddsToBalance) =>
                update({ depositAddsToBalance })
              }
            />
          ) : null}
          {form.destination === 'deposit' && form.depositAddsToBalance ? (
            <>
              <Select
                label={tf('depositAccount')}
                options={accountItems}
                value={form.depositAccountId || null}
                onValueChange={(depositAccountId) =>
                  update({ depositAccountId })
                }
                placeholder={tf('accountPlaceholder')}
                error={errorText(errors.depositAccountId)}
                closeLabel={t('common.close')}
              />
              <SwitchRow
                label={tf('countsAsIncome')}
                hint={tf('countsAsIncomeHint')}
                checked={form.depositCountsAsIncome}
                onCheckedChange={(depositCountsAsIncome) =>
                  update({ depositCountsAsIncome })
                }
              />
            </>
          ) : null}
        </TwView>
      )}

      {scheduled ? (
        <TwView className="gap-1">
          <Select
            label={tf('paymentAccount')}
            options={accountItems}
            value={form.paymentAccountId || null}
            onValueChange={(paymentAccountId) => update({ paymentAccountId })}
            placeholder={tf('accountPlaceholder')}
            closeLabel={t('common.close')}
          />
          <Text className="px-1 text-xs text-on-surface-variant">
            {tf('paymentAccountHint')}
          </Text>
        </TwView>
      ) : null}
    </TwView>
  );
}
