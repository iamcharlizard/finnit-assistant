import * as React from 'react';
import { useTranslations } from 'use-intl';
import { ChevronRight, Landmark, PencilLine, type LucideIcon } from 'lucide-react-native';

import { accountErrorMessage, createManualAccount } from '@finnit/core/accounts/api';
import { MEXICAN_BANKS, OTHER_BANK } from '@finnit/core/accounts/banks';
import {
  CURRENCIES,
  MANUAL_ACCOUNT_TYPES,
  deriveAccountName,
  emptyManualAccountForm,
  hasBank,
  validateWizard,
  type Currency,
  type ErrorCode,
  type FormErrors,
  type ManualAccountForm,
  type ManualAccountType,
} from '@finnit/core/accounts/form';
import { TwPressable, TwScrollView, TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Input } from '@finnit/ui-native/components/ui/input';
import { MoneyInput } from '@finnit/ui-native/components/ui/money-input';
import { NumberInput } from '@finnit/ui-native/components/ui/number-input';
import { Segmented } from '@finnit/ui-native/components/ui/segmented';
import { Select } from '@finnit/ui-native/components/ui/select';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

type Mode = 'choose' | 'manual';

const CHOICES: readonly { mode: 'bank' | 'manual'; icon: LucideIcon }[] = [
  { mode: 'bank', icon: Landmark },
  { mode: 'manual', icon: PencilLine },
];

/**
 * "Agregar cuenta": first the choice between connecting the bank (Syncfy's
 * flow, `onConnectBank`) and adding it by hand; then a manual debit, credit,
 * cash or savings account in one form (the web's wizard without the design
 * step: it keeps Finnit's look).
 */
export function AddAccountSheet({
  existingNames,
  onClose,
  onConnectBank,
  onCreated,
}: {
  existingNames: readonly string[];
  onClose: () => void;
  onConnectBank: () => void;
  onCreated: (accountId: string) => void;
}) {
  const l = useLocalizer();
  const t = useTranslations();
  const tw = useTranslations('accounts.wizard');
  const tc = useTranslations('accounts.addChoice');
  const gql = useGql();
  const [mode, setMode] = React.useState<Mode>('choose');
  const [form, setForm] = React.useState<ManualAccountForm>(() => ({
    ...emptyManualAccountForm(),
    type: 'debit',
  }));
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const type = form.type ?? 'debit';
  const isCredit = type === 'credit';
  const err = (code: ErrorCode | undefined) => (code ? l.t(`accounts.errors.${code}`) : undefined);
  const update = (patch: Partial<ManualAccountForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setErrors({});
  };

  const bankOptions = React.useMemo(
    () => [
      ...MEXICAN_BANKS.map((bank) => ({ value: bank as string, label: bank })),
      { value: OTHER_BANK, label: tw('bankOther') },
    ],
    [tw],
  );

  async function submit() {
    const { errors: found } = validateWizard(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const typeLabel = l.t(`finance.accountTypes.${type}`);
      const created = await createManualAccount(form, {
        baseName: deriveAccountName(form, typeLabel),
        existingNames,
        run: gql,
      });
      // The card terms failing is not worth stopping for: the account exists.
      onCreated(created.id);
    } catch (error) {
      setSubmitError(accountErrorMessage(error, l.t));
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && !saving && onClose()}
      title={tw('title')}
      description={mode === 'choose' ? tc('description') : tw('description')}
      closeLabel={t('common.close')}
    >
      {mode === 'choose' ? (
        <TwView className="gap-3 pb-2">
          {CHOICES.map(({ mode: choice, icon }) => (
            <TwPressable
              key={choice}
              accessibilityRole="button"
              onPress={() => (choice === 'bank' ? onConnectBank() : setMode('manual'))}
              className="flex-row items-center gap-4 rounded-input border border-input bg-surface p-4 active:bg-accent"
            >
              <TwView className="size-11 items-center justify-center rounded-xl bg-brand-10">
                <Icon icon={icon} size={20} color="--brand-ink" />
              </TwView>
              <TwView className="flex-1 gap-0.5">
                <TwView className="flex-row flex-wrap items-center gap-2">
                  <Text weight="bold" className="text-sm">
                    {tc(`${choice}.title`)}
                  </Text>
                  {choice === 'bank' ? (
                    <TwView className="rounded-full bg-income-10 px-2 py-0.5">
                      <Text className="text-[11px] text-income">{tc('bank.badge')}</Text>
                    </TwView>
                  ) : null}
                </TwView>
                <Text className="text-[13px] text-on-surface-variant">{tc(`${choice}.description`)}</Text>
              </TwView>
              <Icon icon={ChevronRight} size={20} color="--on-surface-variant" />
            </TwPressable>
          ))}
        </TwView>
      ) : (
        <TwScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 600 }} contentContainerClassName="gap-4 pb-2">
          <Select<ManualAccountType>
            label={tw('typeQuestion')}
            title={tw('typeQuestion')}
            value={type}
            options={MANUAL_ACCOUNT_TYPES.map((value) => ({
              value,
              label: tw(`types.${value}.title`),
              hint: tw(`types.${value}.hint`),
            }))}
            onValueChange={(value) => update({ type: value })}
            closeLabel={t('common.close')}
          />

          {hasBank(type) ? (
            <>
              <Select
                label={type === 'savings' ? tw('bankOptional') : tw('bank')}
                title={tw('bank')}
                value={form.bankChoice || null}
                options={bankOptions}
                onValueChange={(bankChoice) => update({ bankChoice })}
                placeholder={tw('bankPlaceholder')}
                searchable
                searchPlaceholder={tw('bankSearch')}
                emptyLabel={tw('bankEmpty')}
                error={err(errors.bank)}
                closeLabel={t('common.close')}
              />
              {form.bankChoice === OTHER_BANK ? (
                <Input
                  label={tw('bankOtherLabel')}
                  placeholder={tw('bankOtherPlaceholder')}
                  value={form.bankOther}
                  onChangeText={(bankOther) => update({ bankOther })}
                />
              ) : null}
              <NumberInput
                label={tw('last4')}
                placeholder={tw('last4Placeholder')}
                value={form.last4}
                maxDigits={4}
                onValueChange={(last4) => update({ last4 })}
                error={err(errors.last4)}
              />
            </>
          ) : null}

          <TwView className="gap-1">
            <Input
              label={tw('nickname')}
              placeholder={tw('nicknamePlaceholder')}
              value={form.nickname}
              onChangeText={(nickname) => update({ nickname })}
              error={err(errors.nickname)}
            />
            <Text className="px-1 text-xs text-on-surface-variant">{tw('nicknameHint')}</Text>
          </TwView>

          <TwView className="gap-1.5">
            <Text className="px-1 text-sm text-on-surface-variant">{tw('currency')}</Text>
            <Segmented<Currency>
              value={form.currency}
              options={CURRENCIES.map((value) => ({ value, label: tw(`currencies.${value}`) }))}
              onValueChange={(currency) => update({ currency })}
              accessibilityLabel={tw('currency')}
            />
          </TwView>

          {isCredit ? (
            <>
              <TwView className="gap-1">
                <MoneyInput
                  label={tw('debt')}
                  value={form.debt}
                  onValueChange={(debt) => update({ debt })}
                  currency={form.currency}
                  error={err(errors.debt)}
                />
                <Text className="px-1 text-xs text-on-surface-variant">{tw('debtHint')}</Text>
              </TwView>
              <MoneyInput
                label={tw('creditLimit')}
                value={form.creditLimit}
                onValueChange={(creditLimit) => update({ creditLimit })}
                currency={form.currency}
                error={err(errors.creditLimit)}
              />
              <Text weight="bold" className="px-1 text-sm">
                {tw('termsTitle')}
              </Text>
              <TwView className="flex-row gap-3">
                <NumberInput
                  className="flex-1"
                  label={tw('statementDay')}
                  placeholder={tw('dayPlaceholder')}
                  value={form.statementDay}
                  maxDigits={2}
                  onValueChange={(statementDay) => update({ statementDay })}
                  error={err(errors.statementDay)}
                />
                <NumberInput
                  className="flex-1"
                  label={tw('paymentDueDay')}
                  placeholder={tw('dayPlaceholder')}
                  value={form.paymentDueDay}
                  maxDigits={2}
                  onValueChange={(paymentDueDay) => update({ paymentDueDay })}
                  error={err(errors.paymentDueDay)}
                />
              </TwView>
              <NumberInput
                label={tw('interestRate')}
                placeholder={tw('interestRatePlaceholder')}
                value={form.interestRate}
                onValueChange={(interestRate) => update({ interestRate })}
                decimals={4}
                suffix="%"
                error={err(errors.interestRate)}
              />
            </>
          ) : (
            <TwView className="gap-1">
              <MoneyInput
                label={tw('balance')}
                value={form.balance}
                onValueChange={(balance) => update({ balance })}
                currency={form.currency}
                error={err(errors.balance)}
              />
              <Text className="px-1 text-xs text-on-surface-variant">{tw('balanceHint')}</Text>
            </TwView>
          )}

          {submitError ? (
            <Text accessibilityRole="alert" className="text-[13px] text-expense">
              {submitError}
            </Text>
          ) : null}

          <TwView className="flex-row justify-end gap-2">
            <Button variant="outline" label={tw('back')} disabled={saving} onPress={() => setMode('choose')} />
            <Button
              variant="secondary"
              label={saving ? tw('creating') : tw('create')}
              disabled={saving}
              onPress={() => void submit()}
            />
          </TwView>
        </TwScrollView>
      )}
    </Sheet>
  );
}
