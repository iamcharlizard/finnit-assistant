'use client';

import { useTranslations } from 'next-intl';

import { Input } from '@finnit/ui/components/ui/input';

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
        <Input
          label={t('statementDay')}
          inputMode="numeric"
          maxLength={2}
          placeholder={t('dayPlaceholder')}
          value={value.statementDay}
          onChange={(e) =>
            onChange({ statementDay: e.target.value.replace(/\D/g, '') })
          }
          error={errors.statementDay}
        />
        <Input
          label={t('paymentDueDay')}
          inputMode="numeric"
          maxLength={2}
          placeholder={t('dayPlaceholder')}
          value={value.paymentDueDay}
          onChange={(e) =>
            onChange({ paymentDueDay: e.target.value.replace(/\D/g, '') })
          }
          error={errors.paymentDueDay}
        />
      </div>
      <Input
        label={t('interestRate')}
        inputMode="decimal"
        placeholder={t('interestRatePlaceholder')}
        value={value.interestRate}
        onChange={(e) => onChange({ interestRate: e.target.value })}
        error={errors.interestRate}
      />
    </div>
  );
}
