'use client';

import * as React from 'react';

import { cn } from '../../lib/utils';
import { Label } from './label';

interface InputProps extends React.ComponentProps<'input'> {
  label?: string;
  error?: string;
}

function Input({ className, label, error, id, ...props }: InputProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  const input = (
    <input
      id={inputId}
      data-slot="input"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      className={cn(
        'min-h-11 w-full min-w-0 rounded-input border border-input bg-surface px-4 py-3 text-body-md text-on-background outline-none transition-[color,box-shadow] placeholder:text-on-surface-variant/70 disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40',
        'aria-invalid:border-expense aria-invalid:ring-expense/20',
        className,
      )}
      {...props}
    />
  );

  if (!label && !error) return input;

  return (
    <div className="flex flex-col gap-1">
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      {input}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-expense">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { Input, type InputProps };
