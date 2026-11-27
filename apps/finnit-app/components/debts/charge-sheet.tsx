import * as React from 'react';
import { useTranslations } from 'use-intl';

import { budgetCategoryOptions } from '@finnit/core/budgets/options';
import type { BudgetCategory } from '@finnit/core/budgets/types';
import { addDebtCharge, debtErrorMessage, updateDebtCharge } from '@finnit/core/debts/api';
import {
  addsToBalanceByDefault,
  asksFirstPayment,
  asksPaidInstallments,
  chargeFormOf,
  chargePreview,
  newChargeForm,
  validateChargeForm,
  type ChargeErrorCode,
  type ChargeForm,
  type ChargeFormErrors,
} from '@finnit/core/debts/charge-form';
import { loanAccounts } from '@finnit/core/debts/detail-view';
import { hasErrors } from '@finnit/core/debts/form';
import { destinationOfMethod, LENDING_METHODS, type ApiDebt, type ApiDebtCharge, type LendingMethod } from '@finnit/core/debts/types';
import type { DayKey } from '@finnit/core/finance/dates';
import { DEFAULT_CURRENCY, formatMoney } from '@finnit/core/finance/money';
import type { ApiAccount } from '@finnit/core/finance/types';
import { accountOptions } from '@finnit/core/new-entry/options';
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
import { ToggleGroup } from '@finnit/ui-native/components/ui/toggle-group';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/**
 * The web's ChargeDialog: a purchase of a purchase financing, or an amount
 * of a personal loan — added, or edited (the first one too). Its own
 * installments, interest (total or rate + VAT), those already paid, the
 * first due date, and for personal loans how it was lent and whether the
 * money reached an account. Mounted while open.
 */
export function ChargeSheet({
  debt,
  charge,
  accounts,
  categories,
  today,
  onClose,
  onSaved,
}: {
  debt: ApiDebt;
  /** Editing this one; none = adding. */
  charge?: ApiDebtCharge;
  accounts: ApiAccount[];
  categories: BudgetCategory[];
  today: DayKey;
  onClose: () => void;
  onSaved: () => void;
}) {
  const tf = useTranslations('debts.charge');
  const { t, locale } = useLocalizer();
  const gql = useGql();
  const purchase = debt.loanType === 'purchase_financing';
  const personal = debt.loanType === 'personal';
  const [form, setForm] = React.useState<ChargeForm>(() => (charge ? chargeFormOf(charge) : newChargeForm(debt, today)));
  const [errors, setErrors] = React.useState<ChargeFormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  // Until the user decides, old money starts off the balance (spent).
  const balanceChosen = React.useRef(Boolean(charge));

  const money = (n: number) => formatMoney(n, DEFAULT_CURRENCY, locale);
  const errorText = (code: ChargeErrorCode | undefined) => (code ? t(`debts.chargeValidation.${code}`) : undefined);
  const preview = chargePreview(form, debt.paymentFrequency ?? 'monthly');
  const accountItems = React.useMemo(() => accountOptions(loanAccounts(accounts)).map(({ value, label }) => ({ value, label })), [accounts]);
  const categoryItems = React.useMemo(
    () =>
      budgetCategoryOptions(categories, locale).map((o) => ({
        value: o.value,
        label: o.label,
        hint: o.group && o.group !== o.label ? o.group : undefined,
      })),
    [categories, locale],
  );

  function update(patch: Partial<ChargeForm>) {
    if (patch.depositAddsToBalance !== undefined) balanceChosen.current = true;
    else if (patch.date !== undefined && !balanceChosen.current) {
      patch = { ...patch, depositAddsToBalance: addsToBalanceByDefault(patch.date, today) };
    }
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof ChargeForm];
      return next;
    });
  }

  async function save() {
    const found = validateChargeForm(form, { today, needsInstallments: purchase });
    setErrors(found);
    if (hasErrors(found)) return;
    setSaving(true);
    setSubmitError(null);
    try {
      if (charge) await updateDebtCharge(form, charge.id, gql);
      else await addDebtCharge(form, debt.id, gql);
      onSaved();
    } catch (error) {
      setSubmitError(debtErrorMessage(error, t));
      setSaving(false);
    }
  }

  const withInstallments = Boolean(form.installments.trim());

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && !saving && onClose()}
      title={charge ? tf(purchase ? 'editPurchaseTitle' : 'editTitle') : tf(purchase ? 'purchaseTitle' : 'title')}
      description={
        charge
          ? tf('editDescription', { name: debt.name })
          : purchase
            ? tf('purchaseDescription', { name: debt.name })
            : tf('description', { name: debt.name })
      }
      closeLabel={t('common.close')}
      footer={<Button label={saving ? tf('saving') : charge ? tf('save') : tf('submit')} onPress={() => void save()} disabled={saving} className="w-full" />}
    >
      <TwView className="gap-4 pb-2">
        <Input
          label={tf('descriptionLabel')}
          value={form.description}
          maxLength={200}
          placeholder={purchase ? tf('purchasePlaceholder') : tf('placeholder')}
          onChangeText={(description) => update({ description })}
        />
        <MoneyInput
          label={purchase ? tf('purchaseAmount') : tf('amount')}
          value={form.principal}
          onValueChange={(principal) => update({ principal })}
          error={errorText(errors.principal)}
        />
        <DatePicker
          label={tf('date')}
          value={form.date || undefined}
          onChange={(day) => update({ date: day ?? '' })}
          max={today}
          locale={locale}
          error={errorText(errors.date)}
          closeLabel={t('common.close')}
        />
        <NumberInput
          maxDigits={4}
          label={purchase ? tf('installments') : tf('installmentsOptional')}
          placeholder={tf('installmentsPlaceholder')}
          value={form.installments}
          onValueChange={(installments) => update({ installments })}
          error={errorText(errors.installments)}
        />
        {personal && !withInstallments ? <Text className="-mt-2 text-xs text-on-surface-variant">{tf('installmentsHintPersonal')}</Text> : null}
        {withInstallments ? (
          <ToggleGroup
            options={[
              { value: 'total', label: tf('interestTotal') },
              { value: 'rate', label: tf('interestRate') },
            ]}
            value={form.interest}
            onValueChange={(interest) => update({ interest })}
            accessibilityLabel={tf('interest')}
          />
        ) : null}
        {withInstallments && form.interest === 'rate' ? (
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
            <SwitchRow label={tf('vat')} checked={form.includesVat} onCheckedChange={(includesVat) => update({ includesVat })} />
          </>
        ) : (
          <TwView className="gap-1">
            <MoneyInput
              label={tf('totalToRepay')}
              placeholder={tf('totalPlaceholder')}
              value={form.totalToRepay}
              onValueChange={(totalToRepay) => update({ totalToRepay })}
              error={errorText(errors.totalToRepay)}
            />
            <Text className="px-1 text-xs text-on-surface-variant">{tf('totalHint')}</Text>
          </TwView>
        )}
        {asksPaidInstallments(debt, form) ? (
          <TwView className="gap-1">
            <NumberInput
              maxDigits={4}
              label={tf('installmentsPaid')}
              placeholder={tf('installmentsPaidPlaceholder')}
              value={form.installmentsPaid}
              onValueChange={(installmentsPaid) => update({ installmentsPaid })}
              error={errorText(errors.installmentsPaid)}
            />
            <Text className="px-1 text-xs text-on-surface-variant">{tf('installmentsPaidHint')}</Text>
          </TwView>
        ) : null}
        {asksFirstPayment(debt, form) ? (
          <TwView className="gap-1">
            <DatePicker
              label={tf('firstPayment')}
              value={form.firstPaymentDate || undefined}
              onChange={(day) => update({ firstPaymentDate: day ?? '' })}
              locale={locale}
              clearable
              clearLabel={t('debts.detail.clearDate')}
              error={errorText(errors.firstPaymentDate)}
              closeLabel={t('common.close')}
            />
            <Text className="px-1 text-xs text-on-surface-variant">
              {tf(personal && !debt.recurringExpenseId ? 'firstPaymentHint' : 'firstPaymentHintScheduled')}
            </Text>
          </TwView>
        ) : null}
        {preview ? (
          <Text accessibilityLiveRegion="polite" className="rounded-input bg-income-10 p-3 text-sm">
            {tf('preview', { count: Number(form.installments), amount: money(preview.installmentAmount), total: money(preview.totalToRepay) })}
          </Text>
        ) : null}
        <Select
          label={tf('purpose')}
          title={tf('purpose')}
          options={categoryItems}
          value={form.purposeCategoryId || null}
          onValueChange={(purposeCategoryId) => update({ purposeCategoryId })}
          placeholder={tf('purposePlaceholder')}
          searchable
          searchPlaceholder={tf('purposeSearch')}
          emptyLabel={tf('noResults')}
          closeLabel={t('common.close')}
        />
        {personal ? (
          <Select<LendingMethod>
            label={t('debts.lending.label')}
            title={t('debts.lending.label')}
            options={LENDING_METHODS.map((method) => ({ value: method, label: t(`debts.lending.methods.${method}`) }))}
            value={form.lendingMethod || null}
            onValueChange={(lendingMethod) => update({ lendingMethod, destination: destinationOfMethod(lendingMethod) })}
            closeLabel={t('common.close')}
          />
        ) : null}
        <TwView className="gap-1">
          <ToggleGroup
            options={[
              { value: 'deposit', label: t('debts.destinations.deposit') },
              { value: 'purchase', label: t('debts.destinations.purchase') },
            ]}
            value={form.destination}
            onValueChange={(destination) => update({ destination })}
          />
          <Text className="px-1 text-xs text-on-surface-variant">{t(`debts.destinationHints.${form.destination}`)}</Text>
        </TwView>
        {form.destination === 'deposit' ? (
          <SwitchRow
            label={t('debts.loan.addsToBalance')}
            hint={t('debts.loan.addsToBalanceHint')}
            checked={form.depositAddsToBalance}
            onCheckedChange={(depositAddsToBalance) => update({ depositAddsToBalance })}
          />
        ) : null}
        {form.destination === 'deposit' && form.depositAddsToBalance ? (
          <>
            <Select
              label={tf('depositAccount')}
              title={tf('depositAccount')}
              options={accountItems}
              value={form.depositAccountId || null}
              onValueChange={(depositAccountId) => update({ depositAccountId })}
              placeholder={tf('accountPlaceholder')}
              searchable
              searchPlaceholder={tf('accountSearch')}
              emptyLabel={tf('noResults')}
              error={errorText(errors.depositAccountId)}
              closeLabel={t('common.close')}
            />
            <SwitchRow
              label={t('debts.loan.countsAsIncome')}
              hint={t('debts.loan.countsAsIncomeHint')}
              checked={form.depositCountsAsIncome}
              onCheckedChange={(depositCountsAsIncome) => update({ depositCountsAsIncome })}
            />
          </>
        ) : null}
        {submitError ? (
          <Text accessibilityRole="alert" className="text-[13px] text-expense">
            {submitError}
          </Text>
        ) : null}
      </TwView>
    </Sheet>
  );
}

function SwitchRow({ label, hint, checked, onCheckedChange }: { label: string; hint?: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <TwView className="flex-row items-center gap-3">
      <TwView className="min-w-0 flex-1">
        <Text className="text-sm">{label}</Text>
        {hint ? <Text className="text-xs text-on-surface-variant">{hint}</Text> : null}
      </TwView>
      <Switch checked={checked} onCheckedChange={onCheckedChange} accessibilityLabel={label} />
    </TwView>
  );
}
