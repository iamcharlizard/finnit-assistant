'use client';

import { Input } from '@finnit/ui/components/ui/input';

import { PIN_MAX, pinInput } from '@/lib/privacy/pin';

/** A masked numeric field for the privacy PIN (digits only). */
export function PinField({
  label,
  value,
  onChange,
  error,
  autoFocus,
  autoComplete = 'current-password',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
  autoComplete?: 'current-password' | 'new-password' | 'off';
}) {
  return (
    <Input
      label={label}
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={PIN_MAX}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      value={value}
      onChange={(event) => onChange(pinInput(event.target.value))}
      error={error}
      className="tracking-[0.4em]"
    />
  );
}
