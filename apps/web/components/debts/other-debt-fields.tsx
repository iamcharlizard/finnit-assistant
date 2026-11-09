'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Combobox } from '@finnit/ui/components/ui/combobox';
import { DatePicker } from '@finnit/ui/components/ui/date-picker';
import { Input } from '@finnit/ui/components/ui/input';
import { NumberInput } from '@finnit/ui/components/ui/number-input';
import { MoneyInput } from '@finnit/ui/components/ui/money-input';

import { SelectField } from '@/components/recurring/select-field';
import {
  NAME_MAX,
  type DebtErrorCode,
  type DebtForm,
  type DebtFormErrors,
} from '@finnit/core/debts/form';
import { DEBT_KINDS } from '@finnit/core/debts/types';
import type { ApiAccount } from '@finnit/core/finance/types';
import { useLocalizer } from '@/lib/i18n/client';
import { accountOptions } from '@finnit/core/new-entry/options';

/**
 * The fields of a debt that is neither a loan nor a card purchase in
 * installments: what is owed, its rate and minimum payment, its dates and
 * the account it belongs to. Editing an older card debt also shows its
 * kind.
 */
export function OtherDebtFields({
  form,
  errors,
  update,
  accounts,
  keepAccountId,
  showKind = false,
  locked = false,
}: {
  form: DebtForm;
  errors: DebtFormErrors;
  update: (patch: Partial<DebtForm>) => void;
  accounts: ApiAccount[];
  /** Listed even if archived (the debt's current account). */
  keepAccountId: string | null;
  showKind?: boolean;
  /** A loan with terms keeps them; only its name, dates and account change. */
  locked?: boolean;
}) {
  const { t } = useLocalizer();
  const tf = useTranslations('debts.form');
  const locale = useLocale();
  const accountItems = React.useMemo(
    () =>
      accountOptions(accounts, (a) => !a.archived || a.id === keepAccountId),
    [accounts, keepAccountId],
  );
  const errorText = (code: DebtErrorCode | undefined) =>
    code ? t(`debts.validation.${code}`) : undefined;
  const linked = accounts.find((a) => a.id === form.linkedAccountId);

  return (
    <>
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
        {showKind ? (
          <SelectField
            label={tf('kind')}
            disabled={locked}
            value={form.kind}
            options={DEBT_KINDS.map((kind) => ({
              value: kind,
              label: t(`debts.kinds.${kind}`),
            }))}
            onChange={(kind) => update({ kind })}
          />
        ) : null}
      </div>

      {locked ? (
        <p className="rounded-input bg-track/60 p-3 text-xs text-on-background">
          {tf('lockedTerms')}
        </p>
      ) : null}
      <div className={locked ? 'hidden' : 'flex flex-col gap-1'}>
        <MoneyInput
          label={tf('principal')}
          value={form.principal}
          onValueChange={(value) => update({ principal: value })}
          error={errorText(errors.principal)}
        />
        <p className="px-1 text-xs text-on-surface-variant">
          {tf('principalHint')}
        </p>
      </div>

      <div className={locked ? 'hidden' : 'grid gap-4 sm:grid-cols-2'}>
        <NumberInput
          decimals={4}
          suffix="%"
          label={tf('rate')}
          placeholder={tf('ratePlaceholder')}
          value={form.rate}
          onValueChange={(value) => update({ rate: value })}
          error={errorText(errors.rate)}
        />
        <MoneyInput
          label={tf('minPayment')}
          value={form.minPayment}
          onValueChange={(value) => update({ minPayment: value })}
          error={errorText(errors.minPayment)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DatePicker
          label={tf('startDate')}
          value={form.startDate || undefined}
          onChange={(day) => update({ startDate: day ?? '' })}
          locale={locale}
          placeholder={tf('datePlaceholder')}
        />
        <div className="flex flex-col gap-1">
          <DatePicker
            label={tf('dueDate')}
            value={form.dueDate || undefined}
            onChange={(day) => update({ dueDate: day ?? '' })}
            min={form.startDate || undefined}
            locale={locale}
            placeholder={tf('datePlaceholder')}
            error={errorText(errors.dueDate)}
          />
          {form.dueDate ? (
            <button
              type="button"
              onClick={() => update({ dueDate: '' })}
              className="self-start px-1 text-xs font-medium text-income hover:underline"
            >
              {tf('clearDate')}
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Combobox
          label={tf('account')}
          options={accountItems}
          value={form.linkedAccountId || undefined}
          onChange={(linkedAccountId) =>
            update({ linkedAccountId: linkedAccountId ?? '' })
          }
          placeholder={tf('accountPlaceholder')}
          searchPlaceholder={tf('accountSearch')}
          emptyText={tf('noResults')}
          clearable
        />
        <p className="px-1 text-xs text-on-surface-variant">
          {linked?.type === 'credit'
            ? tf('accountCardHint')
            : tf('accountHint')}
        </p>
      </div>
    </>
  );
}
