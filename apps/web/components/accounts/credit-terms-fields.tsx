'use client';

import { useTranslations } from 'next-intl';

import { NumberInput } from '@finnit/ui/components/ui/number-input';

interface TermsValues {
  statementDay: string;
  paymentDueDay: string;
  interestRate: string;
}

/** A credit card's statement day, payment due day and optional rate. */
export function CreditTermsFields({
  value,
  onChange,
  errors,
}: {
  value: TermsValues;
  onChange: (patch: Partial<TermsValues>) => void;
  errors: Partial<Record<keyof TermsValues, string>>;
}) {
  const t = useTranslations('accounts.wizard');
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <NumberInput
          label={t('statementDay')}
          maxDigits={2}
          placeholder={t('dayPlaceholder')}
          value={value.statementDay}
          onValueChange={(value) => onChange({ statementDay: value })}
          error={errors.statementDay}
        />
        <NumberInput
          label={t('paymentDueDay')}
          maxDigits={2}
          placeholder={t('dayPlaceholder')}
          value={value.paymentDueDay}
          onValueChange={(value) => onChange({ paymentDueDay: value })}
          error={errors.paymentDueDay}
        />
      </div>
      <NumberInput
        decimals={4}
        suffix="%"
        label={t('interestRate')}
        placeholder={t('interestRatePlaceholder')}
        value={value.interestRate}
        onValueChange={(value) => onChange({ interestRate: value })}
        error={errors.interestRate}
      />
    </div>
  );
}
