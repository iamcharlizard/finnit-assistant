'use client';

import { useTranslations } from 'next-intl';

import { MoneyInput } from '@finnit/ui/components/ui/money-input';

import type { ManualAccountForm } from '@finnit/core/accounts/form';
import { CreditTermsFields } from './credit-terms-fields';

/** Step 3: today's balance, or a card's debt, limit and dates. */
export function WizardMoneyStep({
  form,
  onChange,
  errors,
}: {
  form: ManualAccountForm;
  onChange: (patch: Partial<ManualAccountForm>) => void;
  errors: Partial<Record<string, string>>;
}) {
  const t = useTranslations('accounts.wizard');

  if (form.type !== 'credit') {
    return (
      <div className="flex flex-col gap-1">
        <MoneyInput
          label={t('balance')}
          currency={form.currency}
          value={form.balance}
          onValueChange={(value) => onChange({ balance: value })}
          error={errors.balance}
        />
        <p className="px-1 text-xs text-on-surface-variant">
          {t('balanceHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <MoneyInput
          label={t('debt')}
          currency={form.currency}
          value={form.debt}
          onValueChange={(value) => onChange({ debt: value })}
          error={errors.debt}
        />
        <p className="px-1 text-xs text-on-surface-variant">{t('debtHint')}</p>
      </div>
      <MoneyInput
        label={t('creditLimit')}
        currency={form.currency}
        value={form.creditLimit}
        onValueChange={(value) => onChange({ creditLimit: value })}
        error={errors.creditLimit}
      />
      <h3 className="pt-1 text-sm font-medium text-on-background">
        {t('termsTitle')}
      </h3>
      <CreditTermsFields
        value={form}
        onChange={onChange}
        errors={{
          statementDay: errors.statementDay,
          paymentDueDay: errors.paymentDueDay,
          interestRate: errors.interestRate,
        }}
      />
    </div>
  );
}
