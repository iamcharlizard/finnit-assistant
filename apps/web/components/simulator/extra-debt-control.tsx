'use client';

import { useTranslations } from 'next-intl';
import { Landmark } from 'lucide-react';

import { MoneyInput } from '@finnit/ui/components/ui/money-input';

import { ControlSection } from './control-section';

/**
 * Extra paid to debts every month. The simulator treats it as one more
 * monthly expense (it doesn't lower the debts' balance or interest).
 */
export function ExtraDebtControl({
  text,
  error,
  onChange,
}: {
  text: string;
  error?: string;
  onChange: (text: string) => void;
}) {
  const t = useTranslations('simulator.extraDebt');
  return (
    <ControlSection
      icon={Landmark}
      title={t('title')}
      description={t('description')}
    >
      <MoneyInput
        label={t('amount')}
        value={text}
        onValueChange={(value) => onChange(value)}
        error={error}
      />
      <p className="px-1 text-xs text-on-surface-variant">{t('note')}</p>
    </ControlSection>
  );
}
