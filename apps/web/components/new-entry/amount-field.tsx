'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Label } from '@finnit/ui/components/ui/label';
import { cn } from '@finnit/ui/lib/utils';

/** The amount, large, with the account's currency next to it. */
export function AmountField({
  value,
  onChange,
  currency,
  error,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  currency: string;
  error?: string;
  autoFocus?: boolean;
  /** Extra classes for the field's box (e.g. a "check this" outline). */
  className?: string;
}) {
  const t = useTranslations('newEntry.fields');
  const id = React.useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{t('amount')}</Label>
      <div
        className={cn(
          'flex min-h-14 items-center gap-2 rounded-input border border-input bg-surface px-4 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40',
          className,
          error && 'border-expense ring-expense/20',
        )}
      >
        <span aria-hidden className="text-title-lg text-on-surface-variant">
          $
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={t('amountPlaceholder')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="min-w-0 flex-1 bg-transparent py-2 text-title-lg font-bold text-on-background tabular-nums outline-none placeholder:text-on-surface-variant/60"
        />
        <span className="rounded-chip bg-track px-2 py-1 text-xs font-medium text-on-surface-variant">
          {currency}
        </span>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-expense">
          {error}
        </p>
      ) : null}
    </div>
  );
}
