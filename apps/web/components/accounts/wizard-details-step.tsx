'use client';

import { useTranslations } from 'next-intl';

import { Input } from '@finnit/ui/components/ui/input';
import { Label } from '@finnit/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@finnit/ui/components/ui/select';

import {
  CURRENCIES,
  NICKNAME_MAX_LENGTH,
  hasBank,
  type Currency,
  type ManualAccountForm,
} from '@/lib/accounts/form';
import { BankField } from './bank-field';

/** Step 2: bank, nickname, last 4 digits and currency. */
export function WizardDetailsStep({
  form,
  onChange,
  errors,
}: {
  form: ManualAccountForm;
  onChange: (patch: Partial<ManualAccountForm>) => void;
  errors: Partial<Record<string, string>>;
}) {
  const t = useTranslations('accounts.wizard');
  const withBank = hasBank(form.type);

  return (
    <div className="flex flex-col gap-4">
      {withBank ? (
        <BankField
          choice={form.bankChoice}
          other={form.bankOther}
          optional={form.type === 'savings'}
          onChange={({ choice, other }) =>
            onChange({ bankChoice: choice, bankOther: other })
          }
          error={errors.bank}
        />
      ) : null}

      <div className="flex flex-col gap-1">
        <Input
          label={t('nickname')}
          value={form.nickname}
          maxLength={NICKNAME_MAX_LENGTH}
          autoComplete="off"
          placeholder={t('nicknamePlaceholder')}
          onChange={(e) => onChange({ nickname: e.target.value })}
          error={errors.nickname}
        />
        <p className="px-1 text-xs text-on-surface-variant">
          {t('nicknameHint')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {withBank ? (
          <Input
            label={t('last4')}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder={t('last4Placeholder')}
            value={form.last4}
            onChange={(e) =>
              onChange({ last4: e.target.value.replace(/\D/g, '') })
            }
            error={errors.last4}
          />
        ) : null}
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-account-currency">{t('currency')}</Label>
          <Select
            value={form.currency}
            onValueChange={(currency) =>
              onChange({ currency: currency as Currency })
            }
          >
            <SelectTrigger id="new-account-currency" className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {t(`currencies.${currency}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
