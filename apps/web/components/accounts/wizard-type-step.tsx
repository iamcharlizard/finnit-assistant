'use client';

import { useTranslations } from 'next-intl';
import {
  Banknote,
  CreditCard,
  PiggyBank,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@finnit/ui/lib/utils';

import {
  MANUAL_ACCOUNT_TYPES,
  type ManualAccountType,
} from '@/lib/accounts/form';

const ICONS: Record<ManualAccountType, LucideIcon> = {
  debit: Wallet,
  credit: CreditCard,
  cash: Banknote,
  savings: PiggyBank,
};

/** Step 1: debit, credit, cash or savings. */
export function WizardTypeStep({
  value,
  onChange,
  error,
}: {
  value: ManualAccountType | null;
  onChange: (type: ManualAccountType) => void;
  error?: string;
}) {
  const t = useTranslations('accounts.wizard');
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm font-medium text-on-background">
        {t('typeQuestion')}
      </legend>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {MANUAL_ACCOUNT_TYPES.map((type) => {
          const Icon = ICONS[type];
          const checked = value === type;
          return (
            <label
              key={type}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-input border border-input bg-surface p-3.5 transition-colors hover:bg-accent has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50',
                checked && 'border-brand bg-brand/10 hover:bg-brand/10',
              )}
            >
              <input
                type="radio"
                name="account-type"
                value={type}
                checked={checked}
                onChange={() => onChange(type)}
                className="sr-only"
              />
              <Icon
                aria-hidden
                className={cn(
                  'mt-0.5 size-5 shrink-0',
                  checked ? 'text-brand-ink' : 'text-on-surface-variant',
                )}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-on-background">
                  {t(`types.${type}.title`)}
                </span>
                <span className="text-xs text-on-surface-variant">
                  {t(`types.${type}.hint`)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-expense">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
