'use client';

import { useTranslations } from 'next-intl';

import { SelectField } from '@/components/recurring/select-field';
import { LENDING_METHODS, type LendingMethod } from '@finnit/core/debts/types';

const NONE = 'none';

/** "¿Cómo te prestó?": cash, transfer, their card… or not said. */
export function LendingMethodField({
  value,
  onChange,
}: {
  value: LendingMethod | '';
  onChange: (method: LendingMethod | '') => void;
}) {
  const t = useTranslations('debts.lending');
  return (
    <SelectField<LendingMethod | typeof NONE>
      label={t('label')}
      value={value || NONE}
      options={[
        { value: NONE, label: t('none') },
        ...LENDING_METHODS.map((method) => ({
          value: method,
          label: t(`methods.${method}`),
        })),
      ]}
      onChange={(next) => onChange(next === NONE ? '' : next)}
    />
  );
}
