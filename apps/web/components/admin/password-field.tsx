'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, Eye, EyeOff, KeyRound, Wand2 } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { InputWithIcon } from '@finnit/ui/components/ui/input-with-icon';

import { MIN_PASSWORD_LENGTH, generatePassword } from '@/lib/admin/users';

/** Password chosen by an admin for someone else: generate, show/hide, copy. */
export function PasswordField({
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
}) {
  const [visible, setVisible] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const t = useTranslations('admin.users.passwordField');

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard blocked (e.g. insecure origin): show it so it can be copied by hand.
      setVisible(true);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <InputWithIcon
        label={label}
        iconLeft={KeyRound}
        iconRight={visible ? EyeOff : Eye}
        iconRightAccessibilityLabel={visible ? t('hide') : t('show')}
        onIconRightClick={() => setVisible((v) => !v)}
        type={visible ? 'text' : 'password'}
        // A password for someone else: keep password managers from saving it.
        autoComplete="new-password"
        data-1p-ignore
        data-lpignore="true"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          placeholder ?? t('minLength', { min: String(MIN_PASSWORD_LENGTH) })
        }
        error={error}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onChange(generatePassword());
            setVisible(true);
          }}
        >
          <Wand2 className="size-4" /> {t('generate')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!value}
          onClick={() => void copy()}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? t('copied') : t('copy')}
        </Button>
      </div>
    </div>
  );
}
