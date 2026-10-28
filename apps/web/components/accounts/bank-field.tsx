'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Combobox } from '@finnit/ui/components/ui/combobox';
import { Input } from '@finnit/ui/components/ui/input';

import { BANK_KEYWORDS, MEXICAN_BANKS, OTHER_BANK } from '@/lib/accounts/banks';

/** Bank of a manual account: a Mexican bank from the list, or "Otro" + name. */
export function BankField({
  choice,
  other,
  onChange,
  optional,
  error,
}: {
  choice: string;
  other: string;
  onChange: (value: { choice: string; other: string }) => void;
  optional?: boolean;
  error?: string;
}) {
  const t = useTranslations('accounts.wizard');
  const options = React.useMemo(
    () => [
      ...MEXICAN_BANKS.map((bank) => ({
        value: bank,
        label: bank,
        keywords: BANK_KEYWORDS[bank],
      })),
      { value: OTHER_BANK, label: t('bankOther'), keywords: ['otro', 'other'] },
    ],
    [t],
  );
  const isOther = choice === OTHER_BANK;

  return (
    <div className="flex flex-col gap-3">
      <Combobox
        label={optional ? t('bankOptional') : t('bank')}
        options={options}
        value={choice || undefined}
        onChange={(value) => onChange({ choice: value ?? '', other })}
        clearable={optional}
        placeholder={t('bankPlaceholder')}
        searchPlaceholder={t('bankSearch')}
        emptyText={t('bankEmpty')}
        error={isOther ? undefined : error}
      />
      {isOther ? (
        <Input
          label={t('bankOtherLabel')}
          value={other}
          maxLength={60}
          autoComplete="off"
          placeholder={t('bankOtherPlaceholder')}
          onChange={(e) => onChange({ choice, other: e.target.value })}
          error={error}
        />
      ) : null}
    </div>
  );
}
