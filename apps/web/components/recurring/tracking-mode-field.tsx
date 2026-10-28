'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Bell, HandCoins, Zap, type LucideIcon } from 'lucide-react';

import { cn } from '@finnit/ui/lib/utils';

import {
  TRACKING_MODES,
  type RecurringTrackingMode,
} from '@/lib/recurring/types';

const ICONS: Record<RecurringTrackingMode, LucideIcon> = {
  automatic: Zap,
  manual: HandCoins,
  reminder: Bell,
};

/** Automatic, manual or reminder, each with a one-line explanation. */
export function TrackingModeField({
  value,
  onChange,
}: {
  value: RecurringTrackingMode;
  onChange: (value: RecurringTrackingMode) => void;
}) {
  const t = useTranslations('recurring');
  const name = React.useId();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wider text-on-surface-variant">
        {t('form.trackingMode')}
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {TRACKING_MODES.map((mode) => {
          const Icon = ICONS[mode];
          const checked = value === mode;
          return (
            <label
              key={mode}
              className={cn(
                'flex cursor-pointer flex-col gap-1 rounded-input border border-input p-3 transition-colors hover:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                checked && 'border-ring bg-accent',
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-on-background">
                <input
                  type="radio"
                  name={name}
                  value={mode}
                  checked={checked}
                  onChange={() => onChange(mode)}
                  className="sr-only"
                />
                <Icon aria-hidden className="size-4 text-violet-ink" />
                {t(`trackingModes.${mode}.label`)}
              </span>
              <span className="text-xs text-on-surface-variant">
                {t(`trackingModes.${mode}.help`)}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
