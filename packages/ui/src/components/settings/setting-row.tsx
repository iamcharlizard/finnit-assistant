import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../../lib/utils';

interface SettingRowProps {
  label: string;
  icon?: LucideIcon;
  description?: string;
  /** id of the control the label describes, for <label htmlFor>. */
  controlId?: string;
  /** Trailing control: Switch, value text, chevron… */
  children?: React.ReactNode;
  className?: string;
}

function SettingRow({
  label,
  icon: Icon,
  description,
  controlId,
  children,
  className,
}: SettingRowProps) {
  return (
    <div
      className={cn(
        'flex min-h-[52px] items-center justify-between gap-3 rounded-xl bg-track px-3 py-2',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {Icon ? (
          <Icon
            aria-hidden
            className="size-5 shrink-0 text-on-surface-variant"
          />
        ) : null}
        <div className="min-w-0">
          <label
            htmlFor={controlId}
            className={cn(
              'block text-base',
              description ? 'text-on-background' : 'text-on-surface-variant',
            )}
          >
            {label}
          </label>
          {description ? (
            <span className="mt-0.5 block text-[10px] uppercase tracking-[0.15em] text-on-surface-variant">
              {description}
            </span>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

export { SettingRow, type SettingRowProps };
