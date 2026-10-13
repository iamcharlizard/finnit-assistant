'use client';

import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';

import { Input } from '@finnit/ui/components/ui/input';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@finnit/ui/components/ui/toggle-group';

import type { IncomeMode } from '@/lib/simulator/scenario';
import { ControlSection } from './control-section';

/** Monthly income in the scenario: a new amount or a change in percent. */
export function IncomeControl({
  mode,
  amountText,
  percentText,
  error,
  result,
  onModeChange,
  onAmountChange,
  onPercentChange,
}: {
  mode: IncomeMode;
  amountText: string;
  percentText: string;
  error?: string;
  /** The scenario's monthly income, formatted. */
  result: string;
  onModeChange: (mode: IncomeMode) => void;
  onAmountChange: (text: string) => void;
  onPercentChange: (text: string) => void;
}) {
  const t = useTranslations('simulator.income');
  return (
    <ControlSection
      icon={TrendingUp}
      title={t('title')}
      description={t('description')}
    >
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(value) => value && onModeChange(value as IncomeMode)}
        aria-label={t('mode')}
        className="flex-wrap"
      >
        <ToggleGroupItem
          value="percent"
          className="min-h-9 px-4 py-1.5 text-xs"
        >
          {t('percentMode')}
        </ToggleGroupItem>
        <ToggleGroupItem value="amount" className="min-h-9 px-4 py-1.5 text-xs">
          {t('amountMode')}
        </ToggleGroupItem>
      </ToggleGroup>
      {mode === 'percent' ? (
        <Input
          label={t('percent')}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={percentText}
          onChange={(e) => onPercentChange(e.target.value)}
          error={error}
        />
      ) : (
        <Input
          label={t('amount')}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amountText}
          onChange={(e) => onAmountChange(e.target.value)}
          error={error}
        />
      )}
      <p className="px-1 text-xs text-on-surface-variant">
        {mode === 'percent' ? t('percentHint') + ' ' : ''}
        {t('result', { amount: result })}
      </p>
    </ControlSection>
  );
}
