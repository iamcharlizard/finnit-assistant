'use client';

import * as React from 'react';

import { cn } from '../../lib/utils';
import { Label } from './label';

interface TextareaProps extends React.ComponentProps<'textarea'> {
  label?: string;
  error?: string;
  /** Helper text under the field (hidden while `error` is shown). */
  hint?: string;
}

function Textarea({
  className,
  label,
  error,
  hint,
  id,
  ...props
}: TextareaProps) {
  const generatedId = React.useId();
  const textareaId = id ?? generatedId;
  const errorId = `${textareaId}-error`;
  const hintId = `${textareaId}-hint`;
  const describedBy =
    [
      error ? errorId : null,
      !error && hint ? hintId : null,
      props['aria-describedby'],
    ]
      .filter(Boolean)
      .join(' ') || undefined;

  const textarea = (
    <textarea
      id={textareaId}
      data-slot="textarea"
      aria-invalid={error ? true : undefined}
      {...props}
      aria-describedby={describedBy}
      className={cn(
        'field-sizing-content min-h-24 w-full min-w-0 resize-y rounded-input border border-input bg-surface px-4 py-3 text-body-md text-on-background outline-none transition-[color,box-shadow] placeholder:text-on-surface-variant/70 disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40',
        'aria-invalid:border-expense aria-invalid:ring-expense/20',
        className,
      )}
    />
  );

  if (!label && !error && !hint) return textarea;

  return (
    <div className="flex flex-col gap-1">
      {label ? <Label htmlFor={textareaId}>{label}</Label> : null}
      {textarea}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-expense">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-on-surface-variant">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export { Textarea, type TextareaProps };
