'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CalendarRange } from 'lucide-react';

import { cn } from '@finnit/ui/lib/utils';

import { MAX_MONTHS, MIN_MONTHS } from '@/lib/simulator/scenario';
import { ControlSection } from './control-section';

const PRESETS = [6, 12, 24, 36];

/** How many months to project, 3–36: a slider and quick choices. */
export function MonthsControl({
  months,
  onChange,
}: {
  months: number;
  onChange: (months: number) => void;
}) {
  const t = useTranslations('simulator.months');
  const id = React.useId();
  return (
    <ControlSection icon={CalendarRange} title={t('title')}>
      <div className="flex items-center gap-3">
        <label htmlFor={id} className="sr-only">
          {t('label')}
        </label>
        <input
          id={id}
          type="range"
          min={MIN_MONTHS}
          max={MAX_MONTHS}
          step={1}
          value={months}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={t('value', { count: months })}
          className="h-11 min-w-0 flex-1 accent-[var(--tertiary)]"
        />
        <output
          htmlFor={id}
          className="w-20 shrink-0 text-right text-sm font-bold text-on-background tabular-nums"
        >
          {t('value', { count: months })}
        </output>
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t('presets')}
      >
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            aria-pressed={months === preset}
            className={cn(
              'min-h-9 rounded-full border border-outline px-3 text-xs font-medium text-on-surface-variant outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
              months === preset &&
                'border-transparent bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {t('value', { count: preset })}
          </button>
        ))}
      </div>
    </ControlSection>
  );
}
