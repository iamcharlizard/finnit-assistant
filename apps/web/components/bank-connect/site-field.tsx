'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, KeyRound, User } from 'lucide-react';
import type { SiteField as SiteFieldDefinition } from '@finnit/bank-connect';

import { InputWithIcon } from '@finnit/ui/components/ui/input-with-icon';
import { Label } from '@finnit/ui/components/ui/label';

/**
 * One field of the bank's login form. Browser autofill and password
 * managers are told not to store these (they are bank credentials for
 * Syncfy, not Finnit's).
 */
export function SiteField({
  field,
  value,
  error,
  onChange,
}: {
  field: SiteFieldDefinition;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = React.useState(false);
  const t = useTranslations('bankConnect.field');
  const id = `bank-field-${field.name}`;

  if (field.type === 'select') {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>{field.label}</Label>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-h-12 rounded-input border border-outline bg-transparent px-4 text-sm text-on-background focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <option value="">{t('select')}</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error ? (
          <p id={`${id}-error`} className="text-[13px] text-expense">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const isPassword = field.type === 'password';
  return (
    <InputWithIcon
      id={id}
      label={field.label}
      error={error}
      iconLeft={isPassword ? KeyRound : User}
      iconRight={isPassword ? (visible ? EyeOff : Eye) : undefined}
      iconRightAccessibilityLabel={
        isPassword ? (visible ? t('hide') : t('show')) : undefined
      }
      onIconRightClick={isPassword ? () => setVisible((v) => !v) : undefined}
      type={isPassword && !visible ? 'password' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={field.required !== false}
      autoComplete="off"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      data-1p-ignore
      data-lpignore="true"
    />
  );
}
