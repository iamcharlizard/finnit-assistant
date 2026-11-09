'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Combobox } from '@finnit/ui/components/ui/combobox';
import { DatePicker } from '@finnit/ui/components/ui/date-picker';
import { Input } from '@finnit/ui/components/ui/input';
import { Label } from '@finnit/ui/components/ui/label';
import { MoneyInput } from '@finnit/ui/components/ui/money-input';
import { NumberInput } from '@finnit/ui/components/ui/number-input';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@finnit/ui/components/ui/toggle-group';

import { SwitchField } from '@/components/finance/switch-field';
import { SelectField } from '@/components/recurring/select-field';
import {
  INSTALLMENT_MONTHS,
  cardInstallmentPreview,
  cardInstallmentSpan,
  cardTermsOf,
  installmentCards,
  type CardInstallmentErrorCode,
  type CardInstallmentErrors,
  type CardInstallmentForm,
} from '@finnit/core/debts/card-installments';
import { NAME_MAX } from '@finnit/core/debts/form';
import { LOAN_INTEREST_MODES } from '@finnit/core/debts/types';
import { shortDate, type DayKey } from '@finnit/core/finance/dates';
import { DEFAULT_CURRENCY, formatMoney } from '@finnit/core/finance/money';
import type { ApiAccount } from '@finnit/core/finance/types';
import { accountOptions } from '@finnit/core/new-entry/options';
import { useLocalizer } from '@/lib/i18n/client';

const OTHER = 'other';

/**
 * A purchase on a credit card in monthly installments: the card, what was
 * bought and for how much, the months, with or without interest (given as
 * in loans), the purchase date and the installments the card already
 * billed (worked out from its cut-offs, editable).
 */
export function CardInstallmentFields({
  form,
  errors,
  update,
  accounts,
  today,
}: {
  form: CardInstallmentForm;
  errors: CardInstallmentErrors;
  update: (patch: Partial<CardInstallmentForm>) => void;
  accounts: ApiAccount[];
  today: DayKey;
}) {
  const { t } = useLocalizer();
  const tf = useTranslations('debts.cardInstallments');
  const locale = useLocale();
  const cards = React.useMemo(() => installmentCards(accounts), [accounts]);
  const cardItems = React.useMemo(() => accountOptions(cards), [cards]);
  const card = cards.find((a) => a.id === form.accountId);
  const currency = card?.currency ?? DEFAULT_CURRENCY;
  const money = (n: number) => formatMoney(n, currency, locale);
  const errorText = (code: CardInstallmentErrorCode | undefined) =>
    code ? t(`debts.cardInstallmentValidation.${code}`) : undefined;

  const preset = INSTALLMENT_MONTHS.map(String).includes(form.months)
    ? form.months
    : '';
  // "Otro" stays picked while the user types a number of their own.
  const [customMonths, setCustomMonths] = React.useState(
    Boolean(form.months) && !preset,
  );
  const monthsChoice = customMonths ? OTHER : preset;

  const preview = cardInstallmentPreview(form);
  const span = cardInstallmentSpan(form, accounts);
  const hasTerms = Boolean(cardTermsOf(card));

  if (cards.length === 0) {
    return (
      <p className="rounded-input bg-track/60 p-3 text-sm text-on-background">
        {tf('noCards')}
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <Combobox
          label={tf('card')}
          options={cardItems}
          value={form.accountId || undefined}
          onChange={(accountId) => update({ accountId: accountId ?? '' })}
          placeholder={tf('cardPlaceholder')}
          searchPlaceholder={t('debts.loan.accountSearch')}
          emptyText={t('debts.loan.noResults')}
          error={errorText(errors.accountId)}
          disabled={Boolean(form.purchaseTransactionId)}
        />
        <p className="px-1 text-xs text-on-surface-variant">{tf('cardHint')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={tf('name')}
          value={form.name}
          maxLength={NAME_MAX}
          autoComplete="off"
          placeholder={tf('namePlaceholder')}
          onChange={(e) => update({ name: e.target.value })}
          error={errorText(errors.name)}
        />
        <DatePicker
          label={tf('purchaseDate')}
          value={form.purchaseDate || undefined}
          onChange={(day) => update({ purchaseDate: day ?? '' })}
          max={today}
          locale={locale}
          placeholder={t('debts.loan.datePlaceholder')}
          error={errorText(errors.purchaseDate)}
        />
      </div>

      <MoneyInput
        label={tf('principal')}
        value={form.principal}
        currency={currency}
        onValueChange={(value) => update({ principal: value })}
        error={errorText(errors.principal)}
      />

      <fieldset className="flex flex-col gap-2">
        <Label className="px-1">{tf('months')}</Label>
        <ToggleGroup
          type="single"
          value={monthsChoice}
          onValueChange={(value) => {
            if (!value) return;
            if (value === OTHER) {
              setCustomMonths(true);
              return;
            }
            setCustomMonths(false);
            update({ months: value });
          }}
          className="flex-wrap"
        >
          {INSTALLMENT_MONTHS.map((count) => (
            <ToggleGroupItem key={count} value={String(count)}>
              {tf('monthsOption', { count })}
            </ToggleGroupItem>
          ))}
          <ToggleGroupItem value={OTHER}>{tf('monthsOther')}</ToggleGroupItem>
        </ToggleGroup>
        {customMonths ? (
          <NumberInput
            maxDigits={2}
            label={tf('months')}
            placeholder={tf('monthsPlaceholder')}
            value={form.months}
            onValueChange={(value) => update({ months: value })}
            error={errorText(errors.months)}
          />
        ) : errors.months ? (
          <p role="alert" className="px-1 text-[13px] text-expense">
            {errorText(errors.months)}
          </p>
        ) : null}
      </fieldset>

      <section className="flex flex-col gap-4 rounded-card border border-outline p-4">
        <fieldset className="flex flex-col gap-2">
          <Label className="px-1">{tf('interest')}</Label>
          <ToggleGroup
            type="single"
            value={form.withInterest ? 'with' : 'without'}
            onValueChange={(value) =>
              value && update({ withInterest: value === 'with' })
            }
            className="flex-wrap"
          >
            <ToggleGroupItem value="without">
              {tf('noInterest')}
            </ToggleGroupItem>
            <ToggleGroupItem value="with">{tf('withInterest')}</ToggleGroupItem>
          </ToggleGroup>
        </fieldset>

        {form.withInterest ? (
          <>
            <SelectField
              label={t('debts.loan.interestMode')}
              value={form.interestMode}
              options={LOAN_INTEREST_MODES.map((mode) => ({
                value: mode,
                label: t(`debts.interestModes.${mode}`),
              }))}
              onChange={(interestMode) => update({ interestMode })}
              hint={t(`debts.interestModeHints.${form.interestMode}`)}
            />
            {form.interestMode === 'rate' ? (
              <>
                <NumberInput
                  decimals={4}
                  suffix="%"
                  label={t('debts.loan.rate')}
                  placeholder={t('debts.loan.ratePlaceholder')}
                  value={form.rate}
                  onValueChange={(value) => update({ rate: value })}
                  error={errorText(errors.rate)}
                />
                <SwitchField
                  label={t('debts.loan.vat')}
                  hint={t('debts.loan.vatHint')}
                  checked={form.includesVat}
                  onCheckedChange={(includesVat) => update({ includesVat })}
                />
              </>
            ) : null}
            {form.interestMode === 'total_amount' ? (
              <MoneyInput
                label={t('debts.loan.totalToRepay')}
                value={form.totalToRepay}
                currency={currency}
                onValueChange={(value) => update({ totalToRepay: value })}
                error={errorText(errors.totalToRepay)}
              />
            ) : null}
            {form.interestMode === 'installment_amount' ? (
              <MoneyInput
                label={t('debts.loan.installmentAmount')}
                value={form.installmentAmount}
                currency={currency}
                onValueChange={(value) => update({ installmentAmount: value })}
                error={errorText(errors.installmentAmount)}
              />
            ) : null}
          </>
        ) : null}

        {preview ? (
          <div
            aria-live="polite"
            className="flex flex-col gap-1 rounded-input bg-income/10 p-3 text-sm text-on-background"
          >
            <p>
              {tf('preview', {
                count: Number(form.months),
                amount: money(preview.installmentAmount),
                total: money(preview.totalToRepay),
              })}
              {preview.interest > 0
                ? ` · ${tf('previewInterest', { interest: money(preview.interest) })}`
                : null}
            </p>
            {span ? (
              <p className="text-xs text-on-surface-variant">
                {tf(hasTerms ? 'span' : 'spanNoTerms', {
                  first: shortDate(span.first, locale),
                  last: shortDate(span.last, locale),
                })}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="flex flex-col gap-1">
        <NumberInput
          maxDigits={2}
          label={tf('installmentsPaid')}
          placeholder="0"
          value={form.installmentsPaid}
          onValueChange={(value) => update({ installmentsPaid: value })}
          error={errorText(errors.installmentsPaid)}
        />
        <p className="px-1 text-xs text-on-surface-variant">
          {tf('installmentsPaidHint')}
        </p>
      </div>

      {form.purchaseTransactionId ? (
        <p className="rounded-input bg-track/60 p-3 text-xs text-on-background">
          {tf('purchaseLinked')}
        </p>
      ) : null}
    </>
  );
}
