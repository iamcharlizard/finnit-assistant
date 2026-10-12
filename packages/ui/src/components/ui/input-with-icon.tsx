'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Label } from './label';

interface InputWithIconProps extends React.ComponentProps<'input'> {
  label?: string;
  labelAction?: React.ReactNode;
  iconLeft?: LucideIcon;
  iconRight?: LucideIcon;
  onIconRightClick?: () => void;
  iconRightAccessibilityLabel?: string;
  error?: string;
}

function InputWithIcon({
  label,
  labelAction,
  iconLeft: IconLeft,
  iconRight: IconRight,
  onIconRightClick,
  iconRightAccessibilityLabel,
  error,
  id,
  className,
  ...props
}: InputWithIconProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      {label || labelAction ? (
        <div className="flex items-center justify-between px-1">
          {label ? <Label htmlFor={inputId}>{label}</Label> : <span />}
          {labelAction}
        </div>
      ) : null}

      <div
        className={cn(
          'flex min-h-12 items-center rounded-input border border-input bg-surface transition-[box-shadow,border-color] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40',
          error && 'border-expense',
          className,
        )}
      >
        {IconLeft ? (
          <IconLeft
            aria-hidden
            className="ml-3.5 size-[18px] shrink-0 text-on-surface-variant opacity-60"
          />
        ) : null}

        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'min-w-0 flex-1 bg-transparent py-3 text-body-md text-on-background outline-none placeholder:text-on-surface-variant/60',
            IconLeft ? 'pl-2.5' : 'pl-4',
            IconRight ? 'pr-1' : 'pr-4',
          )}
          {...props}
        />

        {IconRight ? (
          <button
            type="button"
            onClick={onIconRightClick}
            aria-label={iconRightAccessibilityLabel}
            className="flex size-12 shrink-0 items-center justify-center rounded-input text-on-surface-variant outline-none hover:text-on-background focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <IconRight aria-hidden className="size-[18px]" />
          </button>
        ) : null}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="px-1 text-xs text-expense">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { InputWithIcon, type InputWithIconProps };
