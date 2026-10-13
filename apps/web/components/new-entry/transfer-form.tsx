'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CreditCard } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Combobox } from '@finnit/ui/components/ui/combobox';
import { DatePicker } from '@finnit/ui/components/ui/date-picker';
import { Input } from '@finnit/ui/components/ui/input';

import { creditOwed } from '@/lib/finance/accounts';
import { todayKey } from '@/lib/finance/dates';
import { formatMoney } from '@/lib/finance/money';
import {
  currencyOf,
  type TransferDraft,
  type TransferErrors,
} from '@/lib/new-entry/form';
import type { EntryAccount } from '@/lib/new-entry/graphql';
import {
  isCardPayment,
  transferSources,
  transferTargets,
} from '@/lib/new-entry/options';
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
  const locale = useLocale();
  const today = todayKey();

  const sources = React.useMemo(() => transferSources(accounts), [accounts]);
  const targets = React.useMemo(
    () => transferTargets(accounts, draft.fromAccountId),
    [accounts, draft.fromAccountId],
  );
  const from = accounts.find((a) => a.id === draft.fromAccountId);
  const to = accounts.find((a) => a.id === draft.toAccountId);
  const cardPayment = isCardPayment(accounts, draft.toAccountId);
  const money = (amount: number, currency: string) =>
    formatMoney(amount, currency, locale);

  const set = (patch: Partial<TransferDraft>) =>
    onChange({ ...draft, ...patch });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <AmountField
        value={draft.amount}
        onChange={(amount) => set({ amount })}
        currency={currencyOf(accounts, draft.fromAccountId)}
        error={errors.amount && t(`validation.${errors.amount}`)}
        autoFocus
      />
      <div className="flex flex-col gap-1">
        <Combobox
          label={t('fields.from')}
          options={sources}
          value={draft.fromAccountId}
          onChange={(fromAccountId) => {
            const stillValid = transferTargets(accounts, fromAccountId).some(
              (o) => o.value === draft.toAccountId,
            );
            set({
              fromAccountId,
              toAccountId: stillValid ? draft.toAccountId : undefined,
            });
          }}
          placeholder={t('fields.fromPlaceholder')}
          searchPlaceholder={t('fields.accountSearch')}
          emptyText={t('fields.accountEmpty')}
          error={
            errors.fromAccountId && t(`validation.${errors.fromAccountId}`)
          }
        />
        {from ? (
          <p className="text-xs text-on-surface-variant">
            {t('fields.available', {
              amount: money(from.balanceCurrent, from.currency),
            })}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <Combobox
          label={t('fields.to')}
          options={targets}
          value={draft.toAccountId}
          onChange={(toAccountId) => set({ toAccountId })}
          placeholder={t('fields.toPlaceholder')}
          searchPlaceholder={t('fields.accountSearch')}
          emptyText={t('fields.toEmpty')}
          error={errors.toAccountId && t(`validation.${errors.toAccountId}`)}
        />
        {to && cardPayment ? (
          <p className="text-xs text-on-surface-variant">
            {t('fields.owed', { amount: money(creditOwed(to), to.currency) })}
          </p>
        ) : null}
      </div>
      {cardPayment ? (
        <p className="flex items-start gap-2 rounded-xl bg-track p-3 text-sm text-on-background">
          <CreditCard
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-violet-ink"
          />
          {t('cardPaymentHint')}
        </p>
      ) : (
        <p className="text-xs text-on-surface-variant">{t('transferHint')}</p>
      )}
      <DatePicker
        label={t('fields.date')}
        value={draft.date}
        onChange={(date) => set({ date })}
        max={today}
        locale={locale}
        placeholder={t('fields.datePlaceholder')}
        required
        error={errors.date && t(`validation.${errors.date}`)}
      />
      <Input
        label={t('fields.transferDescription')}
        placeholder={t('fields.transferDescriptionPlaceholder')}
        value={draft.description}
        onChange={(e) => set({ description: e.target.value })}
        maxLength={120}
        autoComplete="off"
      />
      {submitError ? (
        <p role="alert" className="text-sm text-expense">
          {submitError}
        </p>
      ) : null}
      <Button type="submit" disabled={busy} className="w-full">
        {busy
          ? busyLabel
          : cardPayment
            ? t('submit.cardPayment')
            : t('submit.transfer')}
      </Button>
    </form>
  );
}
