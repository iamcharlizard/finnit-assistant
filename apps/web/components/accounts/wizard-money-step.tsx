'use client';

import { useTranslations } from 'next-intl';

import { Input } from '@finnit/ui/components/ui/input';

import type { ManualAccountForm } from '@/lib/accounts/form';
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
  const symbol = form.currency === 'USD' ? 'US$' : '$';

  if (form.type !== 'credit') {
    return (
      <div className="flex flex-col gap-1">
        <Input
          label={`${t('balance')} (${symbol})`}
          inputMode="decimal"
          placeholder="0.00"
          value={form.balance}
          onChange={(e) => onChange({ balance: e.target.value })}
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
        <Input
          label={`${t('debt')} (${symbol})`}
          inputMode="decimal"
          placeholder="0.00"
          value={form.debt}
          onChange={(e) => onChange({ debt: e.target.value })}
          error={errors.debt}
        />
        <p className="px-1 text-xs text-on-surface-variant">{t('debtHint')}</p>
      </div>
      <Input
        label={`${t('creditLimit')} (${symbol})`}
        inputMode="decimal"
        placeholder="0.00"
        value={form.creditLimit}
        onChange={(e) => onChange({ creditLimit: e.target.value })}
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
