'use client';

import * as React from 'react';

import { Label } from '@finnit/ui/components/ui/label';
import { Switch } from '@finnit/ui/components/ui/switch';

/** A labeled switch with a hint below the label. */
export function SwitchField({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <Label
          htmlFor={id}
          className="text-sm normal-case tracking-normal text-on-background"
        >
          {label}
        </Label>
        {hint ? (
          <p id={`${id}-hint`} className="text-xs text-on-surface-variant">
            {hint}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
    </div>
  );
}
