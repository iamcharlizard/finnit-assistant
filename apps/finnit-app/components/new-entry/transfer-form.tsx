import * as React from 'react';
import { useTranslations } from 'use-intl';
import { CreditCard } from 'lucide-react-native';

import { creditOwed } from '@finnit/core/finance/accounts';
import { todayKey } from '@finnit/core/finance/dates';
import { formatMoney } from '@finnit/core/finance/money';
import { currencyOf, type TransferDraft, type TransferErrors } from '@finnit/core/new-entry/form';
import type { EntryAccount } from '@finnit/core/new-entry/graphql';
import { isCardPayment, transferSources, transferTargets } from '@finnit/core/new-entry/options';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { DatePicker } from '@finnit/ui-native/components/ui/date-picker';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Input } from '@finnit/ui-native/components/ui/input';
import { Select } from '@finnit/ui-native/components/ui/select';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useLocale } from '@/lib/i18n/i18n-provider';
import { AmountField } from './amount-field';

/** Transferencia between the user's accounts; into a credit card it is a card payment. */
export function TransferForm({
  draft,
  onChange,
  accounts,
  errors,
  busy,
  busyLabel,
  submitError,
  onSubmit,
}: {
  draft: TransferDraft;
  onChange: (draft: TransferDraft) => void;
  accounts: EntryAccount[];
  errors: TransferErrors;
  busy: boolean;
  busyLabel: string;
  submitError: string | null;
  onSubmit: () => void;
}) {
  const t = useTranslations('newEntry');
  const tc = useTranslations('common');
  const { locale } = useLocale();
  const today = todayKey();
  const sources = React.useMemo(() => transferSources(accounts).map(({ value, label }) => ({ value, label })), [accounts]);
  const targets = React.useMemo(
    () => transferTargets(accounts, draft.fromAccountId).map(({ value, label }) => ({ value, label })),
    [accounts, draft.fromAccountId],
  );
  const from = accounts.find((a) => a.id === draft.fromAccountId);
  const to = accounts.find((a) => a.id === draft.toAccountId);
  const cardPayment = isCardPayment(accounts, draft.toAccountId);
  const set = (patch: Partial<TransferDraft>) => onChange({ ...draft, ...patch });

  return (
    <TwView className="gap-4">
      <AmountField
        value={draft.amount}
        onChange={(amount) => set({ amount })}
        currency={currencyOf(accounts, draft.fromAccountId)}
        error={errors.amount && t(`validation.${errors.amount}`)}
        autoFocus
      />
      <TwView className="gap-1">
        <Select
          label={t('fields.from')}
          options={sources}
          value={draft.fromAccountId ?? null}
          onValueChange={(fromAccountId) => {
            const stillValid = transferTargets(accounts, fromAccountId).some((o) => o.value === draft.toAccountId);
            set({ fromAccountId, toAccountId: stillValid ? draft.toAccountId : undefined });
          }}
          placeholder={t('fields.fromPlaceholder')}
          searchPlaceholder={t('fields.accountSearch')}
          emptyLabel={t('fields.accountEmpty')}
          error={errors.fromAccountId && t(`validation.${errors.fromAccountId}`)}
          closeLabel={tc('close')}
        />
        {from ? (
          <Text className="px-1 text-xs text-on-surface-variant">
            {t('fields.available', { amount: formatMoney(from.balanceCurrent, from.currency, locale) })}
          </Text>
        ) : null}
      </TwView>
      <TwView className="gap-1">
        <Select
          label={t('fields.to')}
          options={targets}
          value={draft.toAccountId ?? null}
          onValueChange={(toAccountId) => set({ toAccountId })}
          placeholder={t('fields.toPlaceholder')}
          searchPlaceholder={t('fields.accountSearch')}
          emptyLabel={t('fields.toEmpty')}
          error={errors.toAccountId && t(`validation.${errors.toAccountId}`)}
          closeLabel={tc('close')}
        />
        {to && cardPayment ? (
          <Text className="px-1 text-xs text-on-surface-variant">
            {t('fields.owed', { amount: formatMoney(creditOwed(to), to.currency, locale) })}
          </Text>
        ) : null}
      </TwView>
      {cardPayment ? (
        <TwView className="flex-row items-start gap-2 rounded-xl bg-track p-3">
          <Icon icon={CreditCard} size={16} color="--violet-ink" />
          <Text className="flex-1 text-sm">{t('cardPaymentHint')}</Text>
        </TwView>
      ) : (
        <Text className="text-xs text-on-surface-variant">{t('transferHint')}</Text>
      )}
      <DatePicker
        label={t('fields.date')}
        locale={locale}
        value={draft.date}
        onChange={(date) => set({ date })}
        max={today}
        placeholder={t('fields.datePlaceholder')}
        error={errors.date && t(`validation.${errors.date}`)}
        closeLabel={tc('close')}
      />
      <Input
        label={t('fields.transferDescription')}
        placeholder={t('fields.transferDescriptionPlaceholder')}
        value={draft.description}
        onChangeText={(description) => set({ description })}
        maxLength={120}
      />
      {submitError ? (
        <Text accessibilityRole="alert" className="text-sm text-expense">
          {submitError}
        </Text>
      ) : null}
      <Button
        label={busy ? busyLabel : cardPayment ? t('submit.cardPayment') : t('submit.transfer')}
        disabled={busy}
        onPress={onSubmit}
        className="w-full"
      />
    </TwView>
  );
}
