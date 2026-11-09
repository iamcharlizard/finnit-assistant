import * as React from 'react';
import { useTranslations } from 'use-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import {
  INSTALLMENT_MONTHS,
  SCHEDULE_PAGE,
  cardInstallmentPreview,
  cardInstallmentSpan,
  cardScheduleRows,
  schedulePage,
  type ScheduleRow,
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
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { DatePicker } from '@finnit/ui-native/components/ui/date-picker';
import { Input } from '@finnit/ui-native/components/ui/input';
import { MoneyInput } from '@finnit/ui-native/components/ui/money-input';
import { NumberInput } from '@finnit/ui-native/components/ui/number-input';
import { Select } from '@finnit/ui-native/components/ui/select';
import { Switch } from '@finnit/ui-native/components/ui/switch';
import { Text } from '@finnit/ui-native/components/ui/text';
import { ToggleGroup } from '@finnit/ui-native/components/ui/toggle-group';

import { TextLink } from '@/components/finance/text-link';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

const OTHER = 'other';

/**
 * The web's CardInstallmentFields: a purchase on a credit card in monthly
 * installments (card, item, total, months, interest, purchase date and
 * the installments already billed, worked out from the card's cut-offs).
 */
export function CardInstallmentFields({
  form,
  errors,
  update,
  updateRow,
  accounts,
  today,
}: {
  form: CardInstallmentForm;
  errors: CardInstallmentErrors;
  update: (patch: Partial<CardInstallmentForm>) => void;
  /** One installment changed (a new day moves the next ones too). */
  updateRow: (index: number, patch: Partial<ScheduleRow>) => void;
  accounts: ApiAccount[];
  today: DayKey;
}) {
  const l = useLocalizer();
  const { t, locale } = l;
  const tf = useTranslations('debts.cardInstallments');
  const cards = React.useMemo(() => installmentCards(accounts), [accounts]);
  const cardItems = React.useMemo(
    () => accountOptions(cards).map(({ value, label }) => ({ value, label })),
    [cards],
  );
  const card = cards.find((a) => a.id === form.accountId);
  const currency = card?.currency ?? DEFAULT_CURRENCY;
  const money = (n: number) => formatMoney(n, currency, locale);
  const errorText = (code: CardInstallmentErrorCode | undefined) =>
    code ? t(`debts.cardInstallmentValidation.${code}`) : undefined;

  const preset = INSTALLMENT_MONTHS.map(String).includes(form.months)
    ? form.months
    : '';
  const [customMonths, setCustomMonths] = React.useState(
    Boolean(form.months) && !preset,
  );
  const preview = cardInstallmentPreview(form);
  const rows = cardScheduleRows(form, accounts);
  const [page, setPage] = React.useState(0);
  const shown = rows ? schedulePage(rows, page) : null;
  const current = shown ? shown.start / SCHEDULE_PAGE : 0;
  const span = cardInstallmentSpan(form, accounts);
  const hasTerms = Boolean(cardTermsOf(card));

  if (cards.length === 0) {
    return (
      <Text className="rounded-2xl bg-track p-3 text-sm">{tf('noCards')}</Text>
    );
  }

  return (
    <TwView className="gap-4">
      <TwView className="gap-1">
        <Select
          label={tf('card')}
          options={cardItems}
          value={form.accountId || null}
          onValueChange={(accountId) => update({ accountId })}
          placeholder={tf('cardPlaceholder')}
          error={errorText(errors.accountId)}
          closeLabel={t('common.close')}
          disabled={Boolean(form.purchaseTransactionId)}
        />
        <Text className="px-1 text-xs text-on-surface-variant">
          {tf('cardHint')}
        </Text>
      </TwView>

      <Input
        label={tf('name')}
        value={form.name}
        maxLength={NAME_MAX}
        placeholder={tf('namePlaceholder')}
        onChangeText={(name) => update({ name })}
        error={errorText(errors.name)}
      />

      <DatePicker
        label={tf('purchaseDate')}
        value={form.purchaseDate || undefined}
        onChange={(day) => update({ purchaseDate: day ?? '' })}
        max={today}
        locale={locale}
        error={errorText(errors.purchaseDate)}
        closeLabel={t('common.close')}
      />

      <MoneyInput
        label={tf('principal')}
        value={form.principal}
        currency={currency}
        onValueChange={(principal) => update({ principal })}
        error={errorText(errors.principal)}
      />

      <TwView className="gap-2">
        <Text weight="medium" className="px-1 text-sm">
          {tf('months')}
        </Text>
        <ToggleGroup
          accessibilityLabel={tf('months')}
          value={customMonths ? OTHER : preset || null}
          options={[
            ...INSTALLMENT_MONTHS.map((count) => ({
              value: String(count),
              label: tf('monthsOption', { count }),
            })),
            { value: OTHER, label: tf('monthsOther') },
          ]}
          onValueChange={(value) => {
            if (value === OTHER) {
              setCustomMonths(true);
              return;
            }
            setCustomMonths(false);
            update({ months: value });
          }}
        />
        {customMonths ? (
          <NumberInput
            maxDigits={2}
            label={tf('months')}
            placeholder={tf('monthsPlaceholder')}
            value={form.months}
            onValueChange={(months) => update({ months })}
            error={errorText(errors.months)}
          />
        ) : errors.months ? (
          <Text className="px-1 text-[13px] text-expense">
            {errorText(errors.months)}
          </Text>
        ) : null}
      </TwView>

      <TwView className="gap-4 rounded-3xl border border-outline p-4">
        <ToggleGroup
          accessibilityLabel={tf('interest')}
          value={form.withInterest ? 'with' : 'without'}
          options={[
            { value: 'without', label: tf('noInterest') },
            { value: 'with', label: tf('withInterest') },
          ]}
          onValueChange={(value) => update({ withInterest: value === 'with' })}
        />
        {form.withInterest ? (
          <>
            <Select
              label={t('debts.loan.interestMode')}
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
                  label={t('debts.loan.rate')}
                  placeholder={t('debts.loan.ratePlaceholder')}
                  value={form.rate}
                  onValueChange={(rate) => update({ rate })}
                  error={errorText(errors.rate)}
                />
                <TwView className="flex-row items-center justify-between gap-3">
                  <Text className="flex-1 text-sm">{t('debts.loan.vat')}</Text>
                  <Switch
                    checked={form.includesVat}
                    onCheckedChange={(includesVat) => update({ includesVat })}
                    accessibilityLabel={t('debts.loan.vat')}
                  />
                </TwView>
              </>
            ) : null}
            {form.interestMode === 'total_amount' ? (
              <MoneyInput
                label={t('debts.loan.totalToRepay')}
                value={form.totalToRepay}
                currency={currency}
                onValueChange={(totalToRepay) => update({ totalToRepay })}
                error={errorText(errors.totalToRepay)}
              />
            ) : null}
            {form.interestMode === 'installment_amount' ? (
              <MoneyInput
                label={t('debts.loan.installmentAmount')}
                value={form.installmentAmount}
                currency={currency}
                onValueChange={(installmentAmount) =>
                  update({ installmentAmount })
                }
                error={errorText(errors.installmentAmount)}
              />
            ) : null}
          </>
        ) : null}
        {preview ? (
          <TwView
            accessibilityLiveRegion="polite"
            className="gap-1 rounded-2xl bg-income-10 p-3"
          >
            <Text className="text-sm">
              {tf('preview', {
                count: Number(form.months),
                amount: money(preview.installmentAmount),
                total: money(preview.totalToRepay),
              })}
              {preview.interest > 0
                ? ` · ${tf('previewInterest', { interest: money(preview.interest) })}`
                : ''}
            </Text>
            {span ? (
              <Text className="text-xs text-on-surface-variant">
                {tf(hasTerms ? 'span' : 'spanNoTerms', {
                  first: shortDate(span.first, locale),
                  last: shortDate(span.last, locale),
                })}
              </Text>
            ) : null}
          </TwView>
        ) : null}
      </TwView>

      {rows && shown ? (
        <TwView className="gap-3 rounded-3xl border border-outline p-4">
          <TwView className="flex-row items-center justify-between gap-2">
            <Text weight="bold" className="text-sm">
              {tf('scheduleTitle')}
            </Text>
            {form.schedule ? <TextLink label={tf('scheduleReset')} onPress={() => update({ schedule: null })} /> : null}
          </TwView>
          <Text className="text-xs text-on-surface-variant">{tf('scheduleHint')}</Text>
          {shown.rows.map((row, i) => {
            const index = shown.start + i;
            const number = index + 1;
            return (
              <TwView key={index} className="gap-2 rounded-2xl bg-track p-3">
                <Text weight="medium" className="text-xs text-on-surface-variant">
                  {tf('scheduleNumber', { number, total: rows.length })}
                </Text>
                <DatePicker
                  label={tf('scheduleDate', { number })}
                  value={row.day}
                  onChange={(day) => day && updateRow(index, { day })}
                  min={form.purchaseDate || undefined}
                  locale={locale}
                  closeLabel={t('common.close')}
                />
                <MoneyInput
                  label={tf('scheduleAmount', { number })}
                  value={row.amount}
                  currency={currency}
                  onValueChange={(amount) => updateRow(index, { amount })}
                />
              </TwView>
            );
          })}
          {shown.pages > 1 ? (
            <TwView className="flex-row items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon={ChevronLeft}
                label={tf('schedulePrevious')}
                disabled={current === 0}
                onPress={() => setPage(current - 1)}
              />
              <Text className="text-xs text-on-surface-variant">
                {tf('schedulePage', { from: shown.start + 1, to: shown.start + shown.rows.length, total: rows.length })}
              </Text>
              <Button
                variant="ghost"
                size="sm"
                icon={ChevronRight}
                label={tf('scheduleNext')}
                disabled={current >= shown.pages - 1}
                onPress={() => setPage(current + 1)}
              />
            </TwView>
          ) : null}
          {errors.schedule ? <Text className="text-[13px] text-expense">{errorText(errors.schedule)}</Text> : null}
        </TwView>
      ) : null}

      <TwView className="gap-1">
        <NumberInput
          maxDigits={2}
          label={tf('installmentsPaid')}
          placeholder="0"
          value={form.installmentsPaid}
          onValueChange={(installmentsPaid) => update({ installmentsPaid })}
          error={errorText(errors.installmentsPaid)}
        />
        <Text className="px-1 text-xs text-on-surface-variant">
          {tf('installmentsPaidHint')}
        </Text>
      </TwView>

      {form.purchaseTransactionId ? (
        <Text className="rounded-2xl bg-track p-3 text-xs">
          {tf('purchaseLinked')}
        </Text>
      ) : null}
    </TwView>
  );
}
